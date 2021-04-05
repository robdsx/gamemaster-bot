require('dotenv').config({ path: '../.env' });
const fs = require('fs');
const mongoose = require('mongoose');
const Word = require('../models/word');
let count = 0;
const words = [];

mongoose.connect(process.env.DB_CONNECTION_STRING, { useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false, retryWrites: true })
    .then(console.log(`Connected to database`))
    .catch(err => {
        console.error(`Couldn't connect to database: ${err}`);
    })

try {
    const data = fs.readFileSync('../words.txt', 'utf-8');
    data.toString().split('\n').forEach(line => {
        if(line.length < 5 || line.length > 15) return;
        count++;
        words.push({
            word: line
        })
        console.log(`${count}: ${line}`);
    });
    console.log('Inserting words into the database, please wait...')
    Word.addWords(words).then(async () => {
        console.log(`Added ${words.length} words to the database!`);
        console.log(`Waiting 5s to run random word test...`);
        setTimeout(async () => {
            for(let i = 0; i < 10; i++) {
                let randomWord = await Word.random(15);
                console.log(`${i+1}: ${randomWord.word}`);
            }
            process.exit(0);
        }, 5000);
    })
    .catch((err) => {
        console.error(err);
    });
} catch(err) {
    console.error(err);
}

