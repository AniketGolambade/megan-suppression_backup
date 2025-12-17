const express = require('express');
const router = express.Router();
const fs = require('fs');
const jwt = require('jsonwebtoken');
const { login ,getUsersFromDatabase,getDatabaseLogsFromDatabase, removeSegmentDataFromDatabase,addSegmendDataMasterToDatabase, getSegmendDataMasterFromDatabase,updateStatusFromDatabase,updateDataFromDatabase } = require('./config');
const {CSV_FILE_PATH} =require('./constants');

router.post('/login', (req, res) => {
    const { email, password } = req.body;
    
    login(email, password, (err, user) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {    
            console.log(`Login Function`);
            const token = jwt.sign({ userId: user.id }, 'your-secret-key', { expiresIn: '1h' });
            res.json({ token });
        }
    });
  });

router.get('/getusers', (req, res) => {
    getUsersFromDatabase((err, users) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(users);
        }
    });
});

router.get('/downloadMergedFile/:clientId/:date/:filename', (req, res) => {
    try {
        const { clientId, date,filename } = req.params;
        const filePath = `${CSV_FILE_PATH}/download/${clientId}/${date}/${filename}`;
        //const filePath = `E:/StepIn/meganFiles/download/${clientId}/${date}/merge/${filename}`;
        if (!fs.existsSync(filePath)) {
            res.status(404).send('File not found');
            return;
        }

        res.setHeader('Content-Type', 'text/csv');
        
        res.setHeader('Content-Disposition', `attachment; filename=merge.csv`);

        const fileStream = fs.createReadStream(filePath);

        fileStream.pipe(res);
        
        console.log('Merged file downloaded successfully');
    } catch (error) {
        console.error('Error downloading merged file:', error);
        res.status(500).send('Internal Server Error');
    }
});

router.get('/getDatabaseLogs/:clientId/:date', async (req, res) => {
    try {
        const { clientId, date } = req.params;
        const logs = await getDatabaseLogsFromDatabase(clientId, date);
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


router.get('/getSegmendDataMaster', (req, res) => {
    getSegmendDataMasterFromDatabase((err, users) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(users);
        }
    });
});

router.post('/addSegmendDataMaster', (req, res) => {
    const { clientId, listId, segmentIds, masterSuppressionList } = req.body;
    const segmentIdsArray = segmentIds.split(',').map(id => parseInt(id.trim()));

    addSegmendDataMasterToDatabase(clientId, listId, segmentIdsArray, masterSuppressionList)
        .then(() => {
            res.status(200).json({ message: 'Segment data added successfully' });
        })
        .catch((err) => {
            res.status(500).json({ error: err.message });
        });
});

router.put('/updateStatus', (req, res) => {
    const { clientId, listId,status } = req.body;
    updateStatusFromDatabase(clientId, listId,status)
        .then(() => {
            res.status(200).json({ message: 'Data removed successfully' });
        })
        .catch((err) => {
            console.error('Error removing data:', err);
            res.status(500).json({ error: 'Failed to remove data' });
        });
});


router.delete('/removeSegmendDataMaster', (req, res) => {
    const { clientId, listId } = req.body;
    removeSegmentDataFromDatabase(clientId, listId)
        .then(() => {
            res.status(200).json({ message: 'Data removed successfully' });
        })
        .catch((err) => {
            console.error('Error removing data:', err);
            res.status(500).json({ error: 'Failed to remove data' });
        });
});

router.put('/updateSegmendDataMaster', (req, res) => {
    const { clientId, listId, segmentIds, masterSuppressionList, status,id } = req.body;

    updateDataFromDatabase( clientId, listId, segmentIds, masterSuppressionList, status,id)
    .then(() => {
        res.status(200).json({ message: 'Data update successfully' });
    })
    .catch((err) => {
        console.error('Error removing data:', err);
        res.status(500).json({ error: 'Failed to remove data' });
    });

});

module.exports = router;