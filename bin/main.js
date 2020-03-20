#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const csv_parser_1 = __importDefault(require("csv-parser"));
const stream_1 = require("stream");
const buffer_replace_1 = __importDefault(require("buffer-replace"));
const ballots = {};
const allCandidates = [];
const winners = [];
// eslint-disable-next-line @typescript-eslint/unbound-method,@typescript-eslint/explicit-function-return-type
Array.prototype.shuffle = function () {
    let currentIndex = this.length, temporaryValue, randomIndex;
    // While there remain elements to shuffle...
    while (0 !== currentIndex) {
        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;
        // And swap it with the current element.
        temporaryValue = this[currentIndex];
        this[currentIndex] = this[randomIndex];
        this[randomIndex] = temporaryValue;
    }
    return this;
};
const yargs_1 = __importDefault(require("yargs"));
const path_1 = __importDefault(require("path"));
const argsv = yargs_1.default
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
    .argv;
const verbose = argsv.v;
// eslint-disable-next-line @typescript-eslint/unbound-method
console.verboseLog = function (...args) {
    if (verbose)
        console.log(...args);
};
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
function processBallots(resultsRef, pass = 0) {
    for (const votes of Object.values(ballots)) {
        let casted = false;
        for (let x = 0; !casted; x++) {
            if (votes[x] === undefined) {
                console.verboseLog("Skipping ballot because end of list has been reached and no candidates have won");
                break;
            }
            if (resultsRef[votes[x]] !== undefined) {
                if (pass) {
                    --pass;
                    continue;
                }
                resultsRef[votes[x]]++;
                casted = true;
            }
        }
    }
}
function parseResults() {
    const remainingCandidates = {};
    allCandidates.forEach(value => {
        remainingCandidates[value] = 0;
    });
    for (let i = 0; i < argsv.n; i++) {
        console.verboseLog();
        console.verboseLog();
        console.verboseLog(`Electing candidate ${i + 1}`);
        const seatCandidates = Object.assign({}, remainingCandidates);
        let elected = false;
        while (!elected) {
            let roundResults = Object.assign({}, seatCandidates);
            processBallots(roundResults);
            const totalVotes = Math.round(Object.values(roundResults).reduce((acc, val) => acc + val));
            for (const [candidate, votes] of Object.entries(roundResults)) {
                if (votes > totalVotes / 2) {
                    console.log(`${candidate} won seat number ${i + 1} with ${votes} votes`);
                    winners.push(candidate);
                    delete remainingCandidates[candidate];
                    elected = true;
                }
            }
            if (elected)
                continue;
            console.verboseLog("No winner, killing someone");
            let killed = false;
            for (const [candidate, votes] of Object.entries(roundResults)) {
                if (votes === 0) {
                    console.verboseLog(`${candidate} killed for having no votes at all`);
                    delete seatCandidates[candidate];
                    killed = true;
                }
            }
            if (killed)
                continue;
            const smallest = Math.min(...Object.values(roundResults));
            let lowests = [];
            for (const [candidate, votes] of Object.entries(roundResults)) {
                if (votes == smallest)
                    lowests.push(candidate);
            }
            if (lowests.length === 1) {
                console.verboseLog(`${lowests[0]} killed for having the least amount of votes(${smallest})`);
                delete seatCandidates[lowests[0]];
                killed = true;
            }
            if (killed)
                continue;
            for (let i = 1; i <= 50; i++) {
                console.verboseLog(`Candidates to tie break: ${lowests.join(", ")} with ${smallest} votes with option number ${i + 1}`);
                roundResults = Object.assign({}, seatCandidates);
                processBallots(roundResults, i);
                const results = {};
                lowests.forEach(value => {
                    results[value] = roundResults[value];
                });
                for (const [person, votes] of Object.entries(results)) {
                    if (verbose)
                        process.stdout.write(`${person}: ${votes}, `);
                }
                console.verboseLog();
                const deathnumber = Math.min(...Object.values(results));
                /*const abouttodie: Array<string> = []*/
                lowests = [];
                for (const [candidate, votes] of Object.entries(results)) {
                    if (votes == deathnumber)
                        lowests.push(candidate);
                }
                if (lowests.length === 1) {
                    console.verboseLog(`TIEBREAK: ${lowests[0]} killed for having the least amount of votes(${deathnumber}) at tier ${i + 1}`);
                    delete seatCandidates[lowests[0]];
                    killed = true;
                    break;
                }
            }
            if (killed)
                continue;
            console.error("Unable to find anyone to eliminate. Program will now exit.");
            process.exit(1);
        }
    }
    console.log(`\n\nThe winners are: \n${winners.join("\n")}`);
}
function readCsv(transform, oncb, mapvalcb, mapheadcb) {
    fs_1.default.createReadStream(path_1.default.resolve(process.cwd(), argsv.f))
        .pipe(transform)
        .pipe(csv_parser_1.default({
        //@ts-ignore
        mapValues: mapvalcb,
        mapHeaders: mapheadcb || (({ header }) => header),
        newline: "\n",
        raw: true,
    }))
        .on("data", oncb)
        .on("end", () => {
        parseResults();
    });
}
function extractName(val) {
    const regex = /1 \[(.*)]/;
    return regex.test(val) ? regex.exec(val)[1] : null;
}
switch (argsv.p) {
    case "2019": {
        const transform = new stream_1.Stream.Transform({
            transform: (chunk, encoding, callback) => {
                chunk = buffer_replace_1.default(chunk, "\r\n,\r\n", "\n");
                callback(null, buffer_replace_1.default(chunk, "\n,\n", "\n"));
            }
        });
        readCsv(transform, ({ Vote, Voter }) => {
            if (!ballots[Voter])
                ballots[Voter] = [];
            ballots[Voter].push(Vote.toString());
        }, ({ value, header }) => {
            value = value.toString().trim();
            if (header.toString() === "Vote" && !allCandidates.includes(value))
                allCandidates.push(value);
            return value;
        });
        break;
    }
    case "2020": {
        const transform = new stream_1.Stream.Transform({
            transform: (chunk, encoding, callback) => {
                callback(null, buffer_replace_1.default(chunk, "\r\n", "\n"));
            }
        });
        readCsv(transform, (args) => {
            if (!args.Token) {
                console.error("file format not supported, Token column is missing, are you using the right parser and is your file formatted correctly?");
                process.exit(1);
            }
            if (!ballots[args.Token])
                ballots[args.Token] = [];
            for (const [key, value] of Object.entries(args)) {
                const parsedKey = parseInt(value);
                if (key !== "Token") {
                    ballots[args.Token][parsedKey - 1] = key;
                }
            }
        }, ({ value }) => {
            value = value.toString().trim();
            return value;
        }, ({ header, index }) => {
            if (index == 1) {
                return "Token";
            }
            header = extractName(header.toString());
            if (!allCandidates.includes(header) && header !== null)
                allCandidates.push(header);
            return header;
        });
    }
}
//# sourceMappingURL=main.js.map