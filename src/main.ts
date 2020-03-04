#!/usr/bin/env node
import fs from "fs"
import csv from "csv-parser"
import {Stream} from "stream"
import replace from "buffer-replace"

const results: {
	[key: string]: Array<string>;
} = {}
const candidates: Array<string> = []
const winners: Array<string> = []

import yargs from "yargs"

const argsv = yargs
	.options({
		"f": {
			alias: "file",
			nargs: 1,
			description: "Uses a file",
			demandOption: true
		},
		"v": {
			alias: "verbose",
			description: "Shows additional information about the process"
		},
		"n": {
			alias: "number",
			description: "Number of candidates to elect",
			default: 4,
		}
	})
	.usage("Usage: $0 -f <file> [options]")
	.example("$0 data.csv", "Parse the file data.csv")
	.help("h")
	.epilog("Program created by alexkar598 using Node.JS. This software is licensed under GPL and if you can read this message, you are allowed to access the source code at https://github.com/alexkar598/irvcounter")
	.argv

const verbose = argsv.v

declare global {
	interface Console {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		vlog(...args: any[]): void;
	}
}

// eslint-disable-next-line @typescript-eslint/unbound-method
console.vlog = function(...args): void {
	if(verbose) console.log(...args)
}



function parseResults(): void {
	const losers: {[key: string]: number} = {}
	candidates.forEach(value => {
		losers[value] = 0
	})

	for(let i=0; i<argsv.n; i++){
		console.vlog(`Starting round ${i + 1}`)
		const base = Object.assign({}, losers)

		const positions: {[key: string]: Array<number>} = {}
		for(const votes of Object.values(results)) {
			for(let x=1; x < votes.length; x++){
				if(positions[votes[x]] === undefined) positions[votes[x]] = []
				positions[votes[x]].push(x)
			}
		}

		const averages: {[key: string]: number} = {}
		for(const [key, value] of Object.entries(positions)){
			averages[key] = value.reduce((previous, current) =>  current + previous) / value.length
		}

		let winner = false
		while(!winner) {
			const roundResults: { [key: string]: number } = Object.assign({}, base)
			for (const votes of Object.values(results)) {
				let casted = false
				for(let x = 0; !casted; x++) {
					if (roundResults[votes[x]] !== undefined) {
						roundResults[votes[x]]++
						casted = true
					}
				}
			}
			const totalVotes = Math.round(Object.values(roundResults).reduce((acc, val) => acc + val))
			for (const [candidate, votes] of Object.entries(roundResults)) {
				if (votes > totalVotes / 2) {
					console.log(`${candidate} won seat number ${i + 1} with ${votes} votes`)
					winners.push(candidate)
					delete losers[candidate]
					winner = true
				}
			}
			if(!winner){
				let allequal = true
				let last
				for(const val of Object.values(roundResults)){
					if(!last) last = val
					if(val !== last) {
						allequal = false
						break
					}
				}

				if(allequal){
					console.log(`Tie detected between ${Object.keys(roundResults).join(", ")}`)
					const localaverage: {[key: string]: number} = {}
					for(const val of Object.keys(roundResults)){
						localaverage[val] = averages[val]
					}
					const bestavg = Math.min(...Object.values(localaverage))
					for(const cand of Object.keys(roundResults)){
						if(localaverage[cand] !== bestavg){
							console.vlog(`${cand} killed for not having the best average of ${bestavg}`)
							delete roundResults[cand]
						}
					}
				}
				console.vlog("No winner, killing smallest")
				const values = Object.values(roundResults)
				const smallest = Math.min(...values)
				for (const [candidate, votes] of Object.entries(roundResults)) {
					if (votes === smallest) {
						console.vlog(`${candidate} killed for having the least amount of votes(${votes})`)
						delete base[candidate]
					}
				}

			}
		}
	}
	console.log(`\n\nThe winners are: \n${winners.join("\n")}`)
}
// noinspection JSUnusedGlobalSymbols
const
	transform = new Stream.Transform({
		transform: (chunk: Buffer, encoding, callback): void => {
			chunk = replace(chunk, "\r\n,\r\n", "\n")
			callback(null, replace(chunk, "\n,\n", "\n"))
		}
	})

// @ts-ignore
fs.createReadStream(argsv.f)
	.pipe(transform)
	.pipe(csv({
		//@ts-ignore
		mapValues: ({value, header}: { value: string; header: Buffer; index: number }) => {
			value = value.toString().trim()
			if (header.toString() === "Vote" && !candidates.includes(value)) candidates.push(value)
			return value
		},
		newline: "\n",
		raw: true,

	}))
	.on("data", ({Vote, Voter}: { Vote: string; Voter: string }) => {
		if (!results[Voter]) results[Voter] = []

		results[Voter].push(Vote.toString())
	})
	.on("end", () => {
		parseResults()
	})

