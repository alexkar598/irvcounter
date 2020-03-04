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
const results = {};
const candidates = [];
const winners = [];
const yargs_1 = __importDefault(require("yargs"));
const argsv = yargs_1.default
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
    .argv;
const verbose = argsv.v;
// eslint-disable-next-line @typescript-eslint/unbound-method
console.vlog = function (...args) {
    if (verbose)
        console.log(...args);
};
function parseResults() {
    const losers = {};
    candidates.forEach(value => {
        losers[value] = 0;
    });
    for (let i = 0; i < argsv.n; i++) {
        console.vlog(`Starting round ${i + 1}`);
        const base = Object.assign({}, losers);
        const positions = {};
        for (const votes of Object.values(results)) {
            for (let x = 1; x < votes.length; x++) {
                if (positions[votes[x]] === undefined)
                    positions[votes[x]] = [];
                positions[votes[x]].push(x);
            }
        }
        const averages = {};
        for (const [key, value] of Object.entries(positions)) {
            averages[key] = value.reduce((previous, current) => current + previous) / value.length;
        }
        let winner = false;
        while (!winner) {
            const roundResults = Object.assign({}, base);
            for (const votes of Object.values(results)) {
                let casted = false;
                for (let x = 0; !casted; x++) {
                    if (roundResults[votes[x]] !== undefined) {
                        roundResults[votes[x]]++;
                        casted = true;
                    }
                }
            }
            const totalVotes = Math.round(Object.values(roundResults).reduce((acc, val) => acc + val));
            for (const [candidate, votes] of Object.entries(roundResults)) {
                if (votes > totalVotes / 2) {
                    console.log(`${candidate} won seat number ${i + 1} with ${votes} votes`);
                    winners.push(candidate);
                    delete losers[candidate];
                    winner = true;
                }
            }
            if (!winner) {
                let allequal = true;
                let last;
                for (const val of Object.values(roundResults)) {
                    if (!last)
                        last = val;
                    if (val !== last) {
                        allequal = false;
                        break;
                    }
                }
                if (allequal) {
                    console.log(`Tie detected between ${Object.keys(roundResults).join(", ")}`);
                    const localaverage = {};
                    for (const val of Object.keys(roundResults)) {
                        localaverage[val] = averages[val];
                    }
                    const bestavg = Math.min(...Object.values(localaverage));
                    for (const cand of Object.keys(roundResults)) {
                        if (localaverage[cand] !== bestavg) {
                            console.vlog(`${cand} killed for not having the best average of ${bestavg}`);
                            delete roundResults[cand];
                        }
                    }
                }
                console.vlog("No winner, killing smallest");
                const values = Object.values(roundResults);
                const smallest = Math.min(...values);
                for (const [candidate, votes] of Object.entries(roundResults)) {
                    if (votes === smallest) {
                        console.vlog(`${candidate} killed for having the least amount of votes(${votes})`);
                        delete base[candidate];
                    }
                }
            }
        }
    }
    console.log(`\n\nThe winners are: \n${winners.join("\n")}`);
}
// noinspection JSUnusedGlobalSymbols
const transform = new stream_1.Stream.Transform({
    transform: (chunk, encoding, callback) => {
        chunk = buffer_replace_1.default(chunk, "\r\n,\r\n", "\n");
        callback(null, buffer_replace_1.default(chunk, "\n,\n", "\n"));
    }
});
// @ts-ignore
fs_1.default.createReadStream(argsv.f)
    .pipe(transform)
    .pipe(csv_parser_1.default({
    //@ts-ignore
    mapValues: ({ value, header }) => {
        value = value.toString().trim();
        if (header.toString() === "Vote" && !candidates.includes(value))
            candidates.push(value);
        return value;
    },
    newline: "\n",
    raw: true,
}))
    .on("data", ({ Vote, Voter }) => {
    if (!results[Voter])
        results[Voter] = [];
    results[Voter].push(Vote.toString());
})
    .on("end", () => {
    parseResults();
});
//# sourceMappingURL=main.js.map