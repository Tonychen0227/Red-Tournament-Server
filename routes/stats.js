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

async function getBestTime() {
    const races = await Race.find({ completed: true });
    let bestTime = null;
    let bestRacer = null;

    for (const race of races) {
        for (const result of race.results) {
            if (result.status !== 'Finished') continue;

            const totalTime = calculateTotalTime(result.finishTime);

            if (bestTime === null || totalTime < bestTime) {
                bestTime = totalTime;
                bestRacer = result.racer;
            }
        }
    }

    if (bestRacer) {
        const bestRacerData = await User.findById(bestRacer).select('displayName').exec();
        return { 
            bestTime, 
            racer: bestRacerData ? bestRacerData.displayName : "Unknown" 
        };
    } else {
        return { bestTime: null, bestRacer: null };
    }
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
        throw error; // Let the caller handle the error
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

async function getWinRate() {
    // Aggregate wins
    const wins = await Race.aggregate([
        { $match: { winner: { $ne: null } } },
        { $group: { _id: "$winner", wins: { $sum: 1 } } }
    ]);

    // Aggregate participation
    const participation = await Race.aggregate([
        { $unwind: "$results" },
        { $match: { "results.status": "Finished" } }, // Only consider finished races
        { $group: { _id: "$results.racer", races: { $sum: 1 } } }
    ]);

    // Merge wins and participation
    const winMap = {};
    wins.forEach(win => {
        winMap[win._id.toString()] = win.wins;
    });

    const participationMap = {};
    participation.forEach(part => {
        participationMap[part._id.toString()] = part.races;
    });

    // Collect all unique racer IDs to fetch display names in bulk
    const racerIds = Object.keys(participationMap);
    const users = await User.find({ _id: { $in: racerIds } }).select('displayName').exec();

    // Create a map of user IDs to display names for quick lookup
    const userMap = {};
    users.forEach(user => {
        userMap[user._id.toString()] = user.displayName;
    });

    // Calculate win rates
    const winRates = racerIds.map(racerId => {
        const wins = winMap[racerId] || 0;
        const races = participationMap[racerId];
        const winRate = races > 0 ? (wins / races) * 100 : 0;

        return {
            racer: userMap[racerId] || "Unknown",
            winRate: parseFloat(winRate.toFixed(2)) // Store as number for accurate sorting
        };
    });

    // Sort the winRates array in descending order by winRate
    winRates.sort((a, b) => b.winRate - a.winRate);

    // Optionally, format the winRate to two decimal places as strings
    // If you prefer to keep them as numbers, you can skip this step
    const formattedWinRates = winRates.map(entry => ({
        racer: entry.racer,
        winRate: entry.winRate.toFixed(2) // Convert back to string with two decimals
    }));

    return formattedWinRates;
}


async function getMostActiveCommentators() {
    const commentators = await Race.aggregate([
        { $unwind: "$commentators" },
        { $group: { _id: "$commentators", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }, // Top 10 active commentators
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

router.get('/', async (req, res) => {
    try {
        const stats = {};

        stats.topTimes = await getTopTimes();
        stats.averageTimePerRound = await getAverageTimePerRound();
        stats.averageTimePerBracket = await getAverageTimePerBracket();
        // stats.winRate = await getWinRate();
        stats.mostActiveCommentators = await getMostActiveCommentators();

        res.json(stats);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching stats' });
    }
});

module.exports = router;
