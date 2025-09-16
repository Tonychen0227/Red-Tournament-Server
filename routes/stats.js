const express = require('express');
const router = express.Router();

const mongoose = require('mongoose');

const User = require('../models/User');
const Race = require('../models/Race');

const ensureAuthenticated = require('../middleware/ensureAuthenticated');

function calculateTotalTime(finishTime) {
    return (
        (finishTime.hours || 0) * 3600000 +
        (finishTime.minutes || 0) * 60000 +
        (finishTime.seconds || 0) * 1000 +
        (finishTime.milliseconds || 0)
    );
}

async function getTopTimes() {
    try {
        // Step 1: Retrieve all completed races
        const races = await Race.find({ completed: true }).select('results').exec();

        // Step 2: Extract all finished results
        const finishedResults = [];
        for (const race of races) {
            for (const result of race.results) {
                if (result.status === 'Finished') {
                    const totalTime = calculateTotalTime(result.finishTime);
                    finishedResults.push({
                        racer: result.racer,
                        totalTime
                    });
                }
            }
        }

        if (finishedResults.length === 0) {
            return []; // No finished results available
        }

        // Step 3: Sort the results by totalTime in ascending order
        finishedResults.sort((a, b) => a.totalTime - b.totalTime);

        // Step 4: Determine the cutoff time for the top 10 (including ties)
        let cutoffTime = null;
        if (finishedResults.length > 10) {
            cutoffTime = finishedResults[9].totalTime; // 10th place time
        }

        // Step 5: Filter results to include all with totalTime <= cutoffTime
        const topBestTimes = finishedResults.filter(result => {
            if (cutoffTime === null) return true; // Less than 10 results
            return result.totalTime <= cutoffTime;
        });

        // Step 6: Extract unique racer IDs from the top best times
        const uniqueRacerIds = [...new Set(topBestTimes.map(result => result.racer.toString()))];

        // Step 7: Fetch display names for all unique racers
        const racers = await User.find({ _id: { $in: uniqueRacerIds } })
        .select('displayName discordUsername')
        .exec();

        // Step 8: Create a map of racer ID to displayName for quick lookup
        const racerMap = {};
        racers.forEach(racer => {
            racerMap[racer._id.toString()] = {
                displayName: racer.displayName || 'Unknown',
                discordUsername: racer.discordUsername || 'Unknown'
            };
        });
    
        // Step 9: Construct the final array with display names and formatted times
        const formattedTopBestTimes = topBestTimes.map(result => ({
            bestTime: result.totalTime,
            racer: racerMap[result.racer.toString()] || { displayName: 'Unknown', discordUsername: 'Unknown' }
        }));
    
        return formattedTopBestTimes;

    } catch (error) {
        console.error('Error in getTopBestTimes:', error);
        throw error;
    }
}

async function getAverageTimePerRound() {
    const races = await Race.find({ completed: true });
    const roundTimes = {};

    races.forEach(race => {
        race.results.forEach(result => {
            if (result.status !== 'Finished') return;
            
            const totalTime = calculateTotalTime(result.finishTime);

            if (!roundTimes[race.round]) {
                roundTimes[race.round] = { totalTime: 0, count: 0 };
            }

            roundTimes[race.round].totalTime += totalTime;
            roundTimes[race.round].count += 1;
        });
    });

    const averages = {};
    for (const round in roundTimes) {
        const { totalTime, count } = roundTimes[round];
        averages[round] = count > 0 ? totalTime / count : 0;
    }

    return averages;
}

async function getAverageTimePerBracket() {
    const races = await Race.find({ completed: true, bracket: { $ne: null } });
    const bracketTimes = {};

    races.forEach(race => {
        race.results.forEach(result => {
            if (result.status !== 'Finished') return; // Only consider finished results
            const totalTime = calculateTotalTime(result.finishTime);

            if (!bracketTimes[race.bracket]) {
                bracketTimes[race.bracket] = { totalTime: 0, count: 0 };
            }

            bracketTimes[race.bracket].totalTime += totalTime;
            bracketTimes[race.bracket].count += 1;
        });
    });

    const averages = {};
    for (const bracket in bracketTimes) {
        const { totalTime, count } = bracketTimes[bracket];
        averages[bracket] = count > 0 ? totalTime / count : 0;
    }

    return averages;
}

async function getMostActiveCommentators() {
    const commentators = await Race.aggregate([
        { $unwind: "$commentators" },
        { $group: { _id: "$commentators", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        {
            $lookup: {
                from: 'users',
                localField: '_id',
                foreignField: '_id',
                as: 'commentatorData'
            }
        },
        { $unwind: "$commentatorData" },
        {
            $project: {
                _id: 0,
                displayName: "$commentatorData.displayName",
                commentatedRaces: "$count"
            }
        }
    ]);

    return commentators;
}

async function getCountryStats() {
    try {
        // Get all runners with their countries
        const runners = await User.find({ 
            role: 'runner', 
            country: { $ne: null, $exists: true, $ne: '' } 
        }).select('country').exec();

        // Count runners by country
        const countryCount = {};
        runners.forEach(runner => {
            if (runner.country) {
                const country = runner.country.toUpperCase();
                countryCount[country] = (countryCount[country] || 0) + 1;
            }
        });

        // Convert to array and sort by count
        const countrySortedArray = Object.entries(countryCount)
            .map(([country, count]) => ({ country, count }))
            .sort((a, b) => b.count - a.count);

        return countrySortedArray;
    } catch (error) {
        console.error('Error in getCountryStats:', error);
        throw error;
    }
}

router.get('/', async (req, res) => {
    try {
        const stats = {};

        stats.topTimes = await getTopTimes();
        stats.averageTimePerRound = await getAverageTimePerRound();
        stats.averageTimePerBracket = await getAverageTimePerBracket();
        stats.mostActiveCommentators = await getMostActiveCommentators();
        stats.countryStats = await getCountryStats();

        res.json(stats);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching stats' });
    }
});

module.exports = router;
