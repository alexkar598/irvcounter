#!/usr/bin/env node
import fs from "fs"
import csv from "csv-parser"
import {Stream, Transform} from "stream"
import replace from "buffer-replace"

const ballots: {
	[key: string]: Array<string>;
} = {}
const allCandidates: Array<string> = []
const winners: Array<string> = []

declare global {
	interface Array<T> {
		shuffle(this: Array<T>): Array<T>;
	}
}

// eslint-disable-next-line @typescript-eslint/unbound-method,@typescript-eslint/explicit-function-return-type
Array.prototype.shuffle = function() {
	let currentIndex = this.length, temporaryValue, randomIndex

	// While there remain elements to shuffle...
	while (0 !== currentIndex) {

		// Pick a remaining element...
		randomIndex = Math.floor(Math.random() * currentIndex)
		currentIndex -= 1

		// And swap it with the current element.
		temporaryValue = this[currentIndex]
		this[currentIndex] = this[randomIndex]
		this[randomIndex] = temporaryValue
	}

	return this
}

import yargs from "yargs"
import path from "path"

const argsv = yargs
	.options({
		"f": {
			alias: "file",
			nargs: 1,
			description: "Uses a file",
			demandOption: true,
			string: true
		},
		"v": {
			alias: "verbose",
			description: "Shows additional information about the process",
			boolean: true
		},
		"n": {
			alias: "number",
			description: "Number of candidates to elect",
			default: 4,
			number: true
		},
		"p": {
			alias: "parser",
			description: "Parser version to use (defaults to latest version, used for historical recounts)",
			default: "2020",
			string: true,
			choices: [
				"2019",
				"2020"
			]
		}
	})
	.usage("Usage: $0 -f <file> [options]")
	.example("$0 data.csv", "Parse the file data.csv")
	.help("h")
	.alias("h", "help")
	.epilog("Program created by alexkar598 using Node.JS. This software is licensed under GPL and if you can read this message, you are allowed to access the source code at https://github.com/alexkar598/irvcounter")
	.argv

const verbose = argsv.v

declare global {
	// noinspection JSUnusedGlobalSymbols
	interface Console {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		verboseLog(...args: any[]): void;
	}
}

// eslint-disable-next-line @typescript-eslint/unbound-method
console.verboseLog = function(...args): void {
	if(verbose) console.log(...args)
}

/*function getAverages(): {[key: string]: number}{
	const positions: {[key: string]: Array<number>} = {}
	for(const votes of Object.values(ballots)) {
		for(let x=1; x < votes.length; x++){
			if(positions[votes[x]] === undefined) positions[votes[x]] = []
			positions[votes[x]].push(x)
		}
	}

	const averages: {[key: string]: number} = {}
	for(const [key, value] of Object.entries(positions)){
		averages[key] = value.reduce((previous, current) =>  current + previous) / value.length
	}
	return averages
}*/

function processBallots(resultsRef: { [key: string]: number }, pass = 0): void{
	for (const votes of Object.values(ballots)) {
		let casted = false
		for(let x = 0; !casted; x++) {
			if(votes[x] === undefined){
				console.verboseLog("Skipping ballot because end of list has been reached and no candidates have won")
				break
			}
			if (resultsRef[votes[x]] !== undefined) {
				if(pass){
					--pass
					continue
				}
				resultsRef[votes[x]]++
				casted = true
			}
		}
	}
}

function parseResults(): void {
	const remainingCandidates: { [key: string]: number } = {}
	allCandidates.forEach(value => {
		remainingCandidates[value] = 0
	})

	for (let i = 0; i < argsv.n; i++) {
		console.verboseLog()
		console.verboseLog()
		console.verboseLog(`Electing candidate ${i + 1}`)
		const seatCandidates = Object.assign({}, remainingCandidates)

		let elected = false
		while (!elected) {
			let roundResults: { [key: string]: number } = Object.assign({}, seatCandidates)
			processBallots(roundResults)

			const totalVotes = Math.round(Object.values(roundResults).reduce((acc, val) => acc + val))
			for (const [candidate, votes] of Object.entries(roundResults)) {
				if (votes > totalVotes / 2) {
					console.log(`${candidate} won seat number ${i + 1} with ${votes} votes`)
					winners.push(candidate)
					delete remainingCandidates[candidate]
					elected = true
				}
			}
			if(elected) continue

			console.verboseLog("No winner, killing someone")

			let killed = false

			for (const [candidate, votes] of Object.entries(roundResults)) {
				if (votes === 0) {
					console.verboseLog(`${candidate} killed for having no votes at all`)
					delete seatCandidates[candidate]
					killed = true
				}
			}

			if(killed) continue

			const smallest = Math.min(...Object.values(roundResults))
			let lowests: Array<string> = []
			for (const [candidate, votes] of Object.entries(roundResults)) {
				if (votes == smallest) lowests.push(candidate)
			}

			if(lowests.length === 1){
				console.verboseLog(`${lowests[0]} killed for having the least amount of votes(${smallest})`)
				delete seatCandidates[lowests[0]]
				killed = true
			}

			if(killed) continue

			for(let i = 1; i<=50; i++) {
				console.verboseLog(`Candidates to tie break: ${lowests.join(", ")} with ${smallest} votes with option number ${i + 1}`)
				roundResults = Object.assign({}, seatCandidates)
				processBallots(roundResults, i)

				const results: {[key: string]: number} = {}
				lowests.forEach(value => {
					results[value] = roundResults[value]
				})

				for(const [person, votes] of Object.entries(results)){
					if(verbose) process.stdout.write(`${person}: ${votes}, `)
				}
				console.verboseLog()

				const deathnumber = Math.min(...Object.values(results))
				/*const abouttodie: Array<string> = []*/
				lowests = []
				for (const [candidate, votes] of Object.entries(results)) {
					if (votes == deathnumber) lowests.push(candidate)
				}

				if(lowests.length === 1){
					console.verboseLog(`TIEBREAK: ${lowests[0]} killed for having the least amount of votes(${deathnumber}) at tier ${i + 1}`)
					delete seatCandidates[lowests[0]]
					killed = true
					break
				}
			}

			if (killed) continue

			console.error("Unable to find anyone to eliminate. Program will now exit.")
			process.exit(1)
		}
	}
	console.log(`\n\nThe winners are: \n${winners.join("\n")}`)
}

function readCsv(transform: Transform, oncb: (args: unknown) => void, mapvalcb?: ({value, header}) => unknown, mapheadcb?: ({header: string, index: number}) => string): void {
	fs.createReadStream(path.resolve(process.cwd(), argsv.f))
		.pipe(transform)
		.pipe(csv({
			//@ts-ignore
			mapValues: mapvalcb,
			mapHeaders: mapheadcb || (({header}): string => header),
			newline: "\n",
			raw: true,

		}))
		.on("data", oncb)
		.on("end", () => {
			parseResults()
		})
}

function extractName(val: string): string | null {
	const regex = /1 \[(.*)]/
	return regex.test(val) ? regex.exec(val)[1] : null
}

switch(argsv.p) {
	case "2019": {
		const transform = new Stream.Transform({
			transform: (chunk: Buffer, encoding, callback): void => {
				chunk = replace(chunk, "\r\n,\r\n", "\n")
				callback(null, replace(chunk, "\n,\n", "\n"))
			}
		})

		readCsv(transform, ({Vote, Voter}: { Vote: string; Voter: string }) => {
			if (!ballots[Voter]) ballots[Voter] = []

			ballots[Voter].push(Vote.toString())
		},({value, header}: { value: string; header: Buffer; index: number }) => {
			value = value.toString().trim()
			if (header.toString() === "Vote" && !allCandidates.includes(value)) allCandidates.push(value)
			return value
		})

		break
	}
	case "2020":{
		const transform = new Stream.Transform({
			transform: (chunk: Buffer, encoding, callback): void => {
				callback(null, replace(chunk, "\r\n", "\n"))
			}
		})
		readCsv(transform, (args: {Token: string; [key: number]: string}) => {
			if(!args.Token){
				console.error("file format not supported, Token column is missing, are you using the right parser and is your file formatted correctly?")
				process.exit(1)
			}
			if (!ballots[args.Token]) ballots[args.Token] = []
			for(const [key, value] of Object.entries(args)){
				const parsedKey = parseInt(value)
				if(key !== "Token"){
					ballots[args.Token][parsedKey-1] = key
				}
			}
		}, ({value}) => {
			value = value.toString().trim()
			return value
		}, ({header, index}) => {
			if(index == 1){
				return "Token"
			}

			header = extractName(header.toString())
			if(!allCandidates.includes(header) && header !== null) allCandidates.push(header)
			return header
		})
	}
}
