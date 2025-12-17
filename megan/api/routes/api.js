const express = require('express');
const router = express.Router();
const axios = require('axios');
const AdmZip = require('adm-zip');
const fs = require('fs');
const archiver = require('archiver');
const path = require('path');
const {format} = require('date-fns');
const fsExtra = require('fs-extra');
const {  con,insertExportData,addExportLog,checkExportDataExists,addExportFilename,addExportData,getListSegmentData,listSegmentData,getUserCredentials} = require('./config');
const {ONGAGE_API_URL,CSV_FILE_PATH,ONGAGE_USERNAME,ONGAGE_PASSWORD,ONGAGE_ACCOUNT,clientId} = require('./constants');
const multer = require('multer');
const winston = require('winston');
// const fetch = require('node-fetch');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({
            filename: 'error.log',
            level: 'error'
        }),
        new winston.transports.File({
            filename: 'combined.log'
        })
    ]
});

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

router.get('/', async (req, res) => {
    res.status(200).json({
        success: 'API Call Success'
    });
});


const createFolder = (folderPath, permissions) => {
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, {
            recursive: true
        });
        fs.chmodSync(folderPath, permissions); // Change permissions
    }
};

router.get('/exportfile', async (req, res) => {
     logger.info('Entered /exportfile endpoint');
    try {
        await new Promise((resolve, reject) => {
            deleteAllData((deleteErr, results) => {
                if (deleteErr) {
                    console.error("Error deleting existing data:", deleteErr);
                    reject(deleteErr);
                } else {
                    console.log("Existing data deleted successfully.");
                    resolve();
                }
            });
        });

        const promises = [];
        var isCompleted;
        //const filteredSegments = await fetchAndAddSegmentsToDatabase(ONGAGE_USERNAME, ONGAGE_PASSWORD, ONGAGE_ACCOUNT);
        //  const listSegmentData = await getListSegmentData();

        var subDownloadFolderPath = "";
        var megan = "Megan";
        for (const {list_id: listId,segment_id: segmentIds}of listSegmentData) {

            const todayDate = new Date().toISOString().slice(0, 10);

            const baseDownloadFolderPath = path.join(__dirname, '../download');
            const baseDownloadMeganFolderPath = path.join(__dirname, '../download', megan);
            const mainDownloadFolderPath = path.join(baseDownloadMeganFolderPath, clientId);
            subDownloadFolderPath = path.join(mainDownloadFolderPath, todayDate);

            createFolder(baseDownloadFolderPath, '0777');
            createFolder(baseDownloadMeganFolderPath, '0777');
            createFolder(mainDownloadFolderPath, '0777');
            createFolder(subDownloadFolderPath, '0777');

            const baseUploadFolderPath = path.join(__dirname, '../upload');
            const baseUploadMeganFolderPath = path.join(__dirname, '../upload', megan);
            const mainUploadFolderPath = path.join(baseUploadMeganFolderPath, clientId);
            const subUploadFolderPath = path.join(mainUploadFolderPath, todayDate);



            createFolder(baseUploadFolderPath, '0777');
            createFolder(baseUploadMeganFolderPath, '0777');
            createFolder(mainUploadFolderPath, '0777');
            createFolder(subUploadFolderPath, '0777');

            // isCompleted = await checkCompletedData(clientId, listId, segmentIds);
            // if (isCompleted) {
            //     console.log(`Skipping list ID ${listId} for client ${clientId} as data for today is already completed`);
            //     continue;
            // }

            const currentDate_name = format(new Date(), 'yyyyMMdd_HHmmss');
            const name = `Megan_Export_${listId}_${currentDate_name}`;
            const date_format = "mm/dd/yyyy";
            const file_format = "csv";
            const status = ["active"];
            const fields_selected = ["email"];

            // if (!name || !date_format || !file_format || !segmentIds || !status) {
            //     return res.status(412).json({
            //         error: 'Invalid Data',
            //         message: 'Missing required parameters'
            //     });
            // }
            
            if (!name || !date_format || !file_format || !segmentIds || !status) {
    logger.error('Validation failed for exportfile request', {
        clientId,
        listId,
        segmentIds,
        received: {
            name,
            date_format,
            file_format,
            segmentIds,
            status
        }
    });
    return res.status(412).json({
        error: 'Invalid Data',
        message: 'Missing required parameters'
    });
}

            const filePath = await processExport(subUploadFolderPath, clientId, listId, segmentIds, name, date_format, file_format, status, fields_selected, ONGAGE_USERNAME, ONGAGE_PASSWORD, ONGAGE_ACCOUNT, clientId);
            promises.push(filePath);
        }
        if (promises.length > 0) {
            await uploadMergeFiles(subDownloadFolderPath, clientId, promises);
        }
        await removeUploadFolder(clientId);
        
        await new Promise((resolve, reject) => {
            deleteAllData((deleteErr, results) => {
                if (deleteErr) {
                    console.error("Error deleting existing data:", deleteErr);
                    reject(deleteErr);
                } else {
                    console.log("Existing data deleted successfully.");
                    resolve();
                }
            });
        });
        
        res.status(200).json({
            success: true,
            message: 'Export completed successfully'
        });


    }
//     catch (error) {
//         console.error('Error:', error);
//         res.status(500).json({
//             error: 'Internal Server Error',
//             message: error.message
//         });
//     }
// });
catch (error) {
    logger.error('Error during /exportfile execution', {
        message: error.message,
        stack: error.stack,
        config: error.config, // if it's an axios error, will contain request details
        response: error.response?.data, // if it's an axios error with response
        status: error.response?.status
    });
    res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
    });
}
});



const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function(req, file, cb) {
        cb(null, file.originalname);
    }
});

const upload = multer({
    storage: storage
});


async function processExport(subUploadFolderPath, clientId, listId, segmentIds, name, date_format, file_format, status, fields_selected, ONGAGE_USERNAME, ONGAGE_PASSWORD, ONGAGE_ACCOUNT, clientId) {
    const exportData = {
        name,
        date_format,
        file_format,
        // segment_id: segmentIds,
            segment_id: Array.isArray(segmentIds) ? segmentIds : [segmentIds], // ✅ Ensure segment_id is always an array
        status,
        fields_selected
    };
    const insertResult = await insertExportData(clientId, listId, segmentIds);
    const insertId = insertResult.id;
    const createExportResponse = await run('POST', `${ONGAGE_API_URL}/${listId}/api/export`, exportData, ONGAGE_USERNAME, ONGAGE_PASSWORD, ONGAGE_ACCOUNT);
    const exportId = createExportResponse.data.payload.id;
    let exportCompleted = false;
    const startDate = new Date();
    await addExportLog(exportId, startDate, " ", " ", exportData, "pending", insertId);
    let statusData1;
    while (!exportCompleted) {
        const getStatusResponse = await axios({
            method: 'GET',
            url: `${ONGAGE_API_URL}/${listId}/api/export/${exportId}`,
            headers: {
                'X_USERNAME': ONGAGE_USERNAME,
                'X_PASSWORD': ONGAGE_PASSWORD,
                'X_ACCOUNT_CODE': ONGAGE_ACCOUNT
            }
        });

        statusData1 = {
            status: getStatusResponse.status,
            status_file: getStatusResponse.data.payload.status_desc
        };
        console.log(`${listId}=${statusData1.status_file}`);

        if (statusData1.status_file === 'Completed') {
            exportCompleted = true;
        } else {
            await delay(30000);
        }
    }

    const retrieveResponse = await axios({
        method: 'GET',
        url: `${ONGAGE_API_URL}/api/export/${exportId}/retrieve`,
        responseType: 'arraybuffer',
        headers: {
            'X_USERNAME': ONGAGE_USERNAME,
            'X_PASSWORD': ONGAGE_PASSWORD,
            'X_ACCOUNT_CODE': ONGAGE_ACCOUNT
        }
    });

    const zip = new AdmZip(retrieveResponse.data);
    const zipEntries = zip.getEntries();
    const firstEntry = zipEntries[0];
    const fileBuffer = firstEntry.getData();
    const csvContent = fileBuffer.toString();
    const csvString = csvContent.split('\n').map(row => row.split(',')).map(row => row[0]).join('\r\n');


    const csvFilePath = path.join(subUploadFolderPath, `${name}_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);

    fs.writeFileSync(csvFilePath, csvString, {
        encoding: 'utf8'
    });

    const finishDate = new Date();

    await addExportLog(exportId, startDate, finishDate, statusData1, exportData, statusData1.status_file, insertId);

    console.log(`Exporting for client ${clientId}, list ${listId}, segment ${segmentIds}`);
    console.log(`Name: ${name}, Date Format: ${date_format}, File Format: ${file_format}, Status: ${status}`);

    return csvFilePath;
}

async function uploadMergeFiles(subDownloadFolderPath, client_id, filePaths) {
    try {

        const response = await handleFileUpload({
            files: filePaths
        }, client_id);

        const name_merge = "Megan_Export";
        const Name_merge_database = `${name_merge}_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`;
        const downloadFileNameZip = `${name_merge}_${format(new Date(), 'yyyyMMdd_HHmmss')}.zip`;

        const csvFilePathDownload = path.join(subDownloadFolderPath, Name_merge_database);
        const downloadFilePathZip = path.join(subDownloadFolderPath, downloadFileNameZip);

        await addExportFilename(client_id, Name_merge_database, downloadFileNameZip);

        await new Promise((resolve, reject) => {
            removeDuplicateRecords("md5", (err, message) => {
                if (err) {
                    reject(err);
                } else {
                    console.log("Success:", message);
                    resolve();
                }
            });
        });

        await downloadMergedFile(csvFilePathDownload, downloadFilePathZip);
        return response;
    } catch (error) {
        console.error('Error uploading merge file:', error);
        throw error;
    }
}

async function handleFileUpload(data, client_id) {
    const {
        files
    } = data;
    if (!files || files.length === 0) {
        throw new Error("Files are required.");
    }
    const uploadPromises = [];
    for (const file of files) {
        const filePath = path.join(file);

        uploadPromises.push(new Promise((resolve, reject) => {
            uploadFile(filePath, (err, result) => {
                if (err) {
                    console.log(err);
                    reject(err);
                } else {

                    resolve();
                }
            });
        }));
    }
}


async function run(sMethod, sUrl, data, ONGAGE_USERNAME, ONGAGE_PASSWORD, ONGAGE_ACCOUNT) {
    try {
        const response = await axios({
            method: sMethod,
            url: sUrl,
            data: data,
            headers: {
                'X_USERNAME': ONGAGE_USERNAME,
                'X_PASSWORD': ONGAGE_PASSWORD,
                'X_ACCOUNT_CODE': ONGAGE_ACCOUNT,
                'Content-Type': 'application/json'
            }
        });
        return response;
    } catch (error) {
        console.error('Error:', error.response.data);
        throw error;
    }
}

async function removeUploadFolder(client_id) {
    try {
        const uploadDir = path.join(`${CSV_FILE_PATH}`, 'upload');
        const MeganDir = path.join(uploadDir, "Megan");
         const clientDir = path.join(MeganDir, client_id);
         const todayDate = new Date().toISOString().slice(0, 10);
         const DateDir = path.join(clientDir, todayDate);
         
        if (fs.existsSync(DateDir)) {
            await fsExtra.remove(DateDir);
            console.log(`Upload folder for client ${DateDir} removed successfully`);
        }
    } catch (error) {
        console.error('Error removing upload folder:', error);
        throw error;
    }

}

async function checkCompletedData(clientId, listId, segment_id) {
    try {
        const currentDate = new Date();
        const date_format_for_check = currentDate.toISOString().split('T')[0];
        const result_data = await checkExportDataExists(clientId, listId, segment_id, date_format_for_check);
        return result_data;
    } catch (error) {
        console.error('Error checking completed data:', error);
        throw error;
    }
}

async function fetchAndAddSegmentsToDatabase(ONGAGE_USERNAME, ONGAGE_PASSWORD, ONGAGE_ACCOUNT) {
    try {
        const responseLists = await axios.get('https://api.ongage.net/api/lists?type=sending', {
            headers: {
                'X_USERNAME': ONGAGE_USERNAME,
                'X_PASSWORD': ONGAGE_PASSWORD,
                'X_ACCOUNT_CODE': ONGAGE_ACCOUNT
            }
        });

        const listIds = responseLists.data.payload.map(item => item.id);

        const filteredSegments = [];
        for (const listId of listIds) {
            const responseSegments = await axios.get(`https://api.ongage.net/${listId}/api/segments`, {
                headers: {
                    'X_USERNAME': ONGAGE_USERNAME,
                    'X_PASSWORD': ONGAGE_PASSWORD,
                    'X_ACCOUNT_CODE': ONGAGE_ACCOUNT
                }
            });

            const segmentsWithMd5 = responseSegments.data.payload.filter(segment => segment.name.toLowerCase().includes('md5'));

            for (const segment of segmentsWithMd5) {
                filteredSegments.push({
                    listid: segment.list_id,
                    list_name: segment.list_name,
                    id: segment.id,
                    segment_name: segment.name
                });
                try {
                    await addExportData(segment.list_id, segment.id, new Date(), new Date());
                } catch (addError) {
                    console.error('Error adding export data:', addError);
                }
            }
        }
        return filteredSegments;
    } catch (error) {
        console.error('Error fetching and adding segments to the database:', error);
        throw error;
    }
}

async function deleteAllData(callback) {
    con.query('TRUNCATE TABLE md5', function(err, results) {
        if (err) {
            callback(err);
        } else {
            callback(null, results);
        }
    });
}

function uploadFile(filePath, callback) {

    const columns = 'email';

    const sql = `LOAD DATA INFILE ? INTO TABLE md5 FIELDS TERMINATED BY ',' LINES TERMINATED BY '\r\n' IGNORE 1 LINES (${columns}) SET md5${columns} = MD5(${columns})`;

    const values = [filePath];
    console.log("PATHH", values);

    con.query(sql, values, function(err, result) {
        if (err) {
            callback(err, null);
        } else {
            callback(null, result);
        }
    });
}

let exportedFilePath;

async function removeDuplicateRecords(tableName, callback) {
    const timestamp = Date.now();
    exportedFilePath = `exported_data_${timestamp}.csv`;

    try {
        const checkDuplicateQuery = `
            SELECT COUNT(*) AS duplicateCount
            FROM (
                SELECT email, md5email, COUNT(*) AS occurrences 
                FROM ${tableName}
                GROUP BY email, md5email 
                HAVING occurrences > 1
            ) AS temp`;

        logger.info("Executing duplicate check query:", checkDuplicateQuery);

        con.query(checkDuplicateQuery, async function(error, results) {
            if (error) {
                logger.error("Error while checking duplicates:", error);
                callback(error);
                return;
            }

            const duplicateCount = results[0].duplicateCount;
            logger.info("Duplicate count:", duplicateCount);

            if (duplicateCount > 0) {
                const exportQuery = `
                    SELECT DISTINCT email, md5email
                    FROM ${tableName}
                    INTO OUTFILE '${exportedFilePath}'
                    FIELDS TERMINATED BY ','
                    LINES TERMINATED BY '\r\n'`;

                logger.info("Executing export query:", exportQuery);

                await new Promise((resolve, reject) => {
                    con.query(exportQuery, function(err, result) {
                        if (err) {
                            logger.error("Error exporting data:", err);
                            reject(err);
                            return;
                        }
                        logger.info("Data exported to file:", exportedFilePath);
                        resolve();
                    });
                });

                await new Promise((resolve, reject) => {
                    con.query(`TRUNCATE TABLE ${tableName}`, function(truncateErr, truncateResult) {
                        if (truncateErr) {
                            logger.error("Error truncating table:", truncateErr);
                            reject(truncateErr);
                            return;
                        }
                        logger.info("Table truncated successfully.");
                        resolve();
                    });
                });

                const loadDataQuery = `
                    LOAD DATA INFILE '${exportedFilePath}'
                    INTO TABLE ${tableName}
                    FIELDS TERMINATED BY ','
                    LINES TERMINATED BY '\r\n'`;

                await new Promise((resolve, reject) => {
                    con.query(loadDataQuery, function(err, result) {
                        if (err) {
                            logger.error("Error loading data:", err);
                            reject(err);
                            return;
                        }
                        logger.info("Data loaded back into the table.");
                        resolve();
                    });
                });

                callback(null, "Duplicate records removed successfully.");
            } else {
                logger.info("No duplicate records found in the table.");
                callback(null, "No duplicate records found in the table.");
            }
        });
    } catch (err) {
        logger.error("Error in removeDuplicateRecords:", err);
        callback(err);
    }
}


async function downloadMd5Data(filePath) {
    return new Promise((resolve, reject) => {
        const sql = "SELECT email, md5email INTO OUTFILE ? FIELDS TERMINATED BY ',' LINES TERMINATED BY '\n' FROM md5";
        const values = [filePath];

        con.query(sql, values, function(err, result) {
            if (err) {
                console.error(err);
                reject(err);
            } else {
                fs.readFile(filePath, (err, data) => {
                    if (err) {
                        console.error(err);
                        reject(err);
                    } else {
                        resolve(data);

                    }
                });
            }
        });
    });
}
async function downloadMergedFile(filePath, zipDownloadFolderPath = '') {
    try {
        const data = await downloadMd5Data(filePath);
        const outputZipFile = fs.createWriteStream(zipDownloadFolderPath);
        const archive = archiver('zip', {
            zlib: { level: 9 } 
        });
        archive.on('error', function(err) {
            throw err;
        });

        archive.pipe(outputZipFile);

        const downloadZipFileInsideZip = `Megan_Export_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`;
        archive.file(filePath, { name: downloadZipFileInsideZip });
        await archive.finalize();

        console.log("Merged file downloaded successfully.");
    } catch (error) {
        console.error('Error downloading merged file:', error);
        throw error;
    }
}


async function fetchLists(account_id) {
  try {
    const { username, account_code, password } = await getUserCredentials(account_id);

    const response = await axios.get(`https://api.ongage.net/api/lists?type=sending`, {
      headers: {
        'X_USERNAME': username,
        'X_PASSWORD': password,
        'X_ACCOUNT_CODE': account_code
      }
    });

    if (!response.data || !response.data.payload) {
      throw new Error('Failed to fetch lists');
    }

    return response.data.payload;
  } catch (error) {
    throw error;
  }
}
router.get('/getlists', async (req, res) => {
    try {
        const { account_id } = req.body; 

        if (!account_id) {
            return res.status(400).json({ error: 'Missing required parameter: account_id' });
        }

        const lists = await fetchLists(account_id);
        const listIds = lists.map(list => ({ id: list.id, name: list.name }));
        res.json(listIds);
    } catch (error) {
        console.error('Error fetching lists:', error);
        res.status(500).json({ error: error.message });
    }
});


module.exports = router;