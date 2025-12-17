const express = require('express');
const router = express.Router();
const { format } = require('date-fns');
const axios = require('axios');
const AdmZip = require('adm-zip');
const fs = require('fs');
const fsExtra = require('fs-extra');
const winston = require('winston');
const path = require('path');
const { ONGAGE_API_URL, CSV_FILE_PATH, ONGAGE_USERNAME, ONGAGE_PASSWORD, ONGAGE_ACCOUNT } = require('./constants');
const {listSegmentDataMaster,addMasterSuppressionExportLog,getSegmendDataMasterFromDatabaseForApi} = require('./config');
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({
            filename: 'combined.log'
        })
    ]
});

const createFolder = (folderPath, permissions) => {
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
        fs.chmodSync(folderPath, permissions); // Change permissions
    }
};

router.post('/getLists', async (req, res) => {
    const { type, name_like } = req.body;
    try {

        let url = `${ONGAGE_API_URL}/api/lists?type=${type}`;

        if (name_like) {
            url += `&name_like=${name_like}`;
        }

        const getResponse = await run_get('GET', url, "", ONGAGE_USERNAME, ONGAGE_PASSWORD, ONGAGE_ACCOUNT);
        const data = {
            metadata: getResponse.data.metadata,
            payload: getResponse.data.payload
        };
        res.status(200).json(data);
    } catch (error) {
        logger.error('Error in /getLists route:', error);
        
        res.status(500).json({ error: 'Getting lists Error' });
    }
});


router.post('/getSegments', async (req, res) => {
    const { list_id } = req.body;
    try {
        const getResponse = await run_get('GET', `${ONGAGE_API_URL}/${list_id}/api/segments?limit=500`, "", ONGAGE_USERNAME, ONGAGE_PASSWORD, ONGAGE_ACCOUNT);
        const data = {
            metadata: getResponse.data.metadata,
            payload: getResponse.data.payload
        };
        res.status(200).json(data);
    } catch (error) {
        logger.error('Error in /getLists route:', error);
        
        res.status(500).json({ error: 'Getting lists Error' });
    }
});

router.get('/exportfile', async (req, res) => {
    try {
            
        const dataFormaster = await getSegmendDataMasterFromDatabaseForApi();   
        // const SrNo = await getSrNo();
   
        
        
        const master = "Master";
        const folder_add = "Add";
        const folder_remove = "Remove";

     // for (const { clientId, lists } of listSegmentDataMaster) {
            
            for (const { clientId,listId, segmentIds, masterSuppressionList } of dataFormaster) {
                
                const segmentIdsWithoutBrackets = segmentIds.slice(1, -1);
                const segmentIdsArray = segmentIdsWithoutBrackets.split(",");
                const segmentIdss = segmentIdsArray.map(id => parseInt(id));    
                    
                 logger.info(clientId);
                 logger.info(listId);
                 logger.info(segmentIdss);
                 logger.info(masterSuppressionList);
                
                const todayDate = new Date().toISOString().slice(0, 10);
                const baseUploadFolderPath = path.join(__dirname, '../upload');
                const baseUploadMeganFolderPath = path.join(__dirname, '../upload', master);
                const mainUploadFolderPath = path.join(baseUploadMeganFolderPath, clientId);
                const DateUploadFolderPath = path.join(mainUploadFolderPath, todayDate);
                const subUploadFolderPath = path.join(DateUploadFolderPath, folder_add);
                const RemoveUploadFolderPath = path.join(DateUploadFolderPath, folder_remove);

                createFolder(baseUploadFolderPath, '0777');
                createFolder(baseUploadMeganFolderPath, '0777');
                createFolder(mainUploadFolderPath, '0777');
                createFolder(RemoveUploadFolderPath, '0777');
                createFolder(subUploadFolderPath, '0777');

                const today = new Date().getDay();
                const date_format = "mm/dd/yyyy";
                const file_format = "csv";
                const status = ["active"];
                const fields_selected = ["email"];

                if (today == 1 || today == 3) {
                    const currentDate_name = format(new Date(), 'yyyyMMdd_HHmmss');
                    
                    const name = `master_Suppression_${listId}_${currentDate_name}`;

                    const filePath = await processExportForRemove(RemoveUploadFolderPath, masterSuppressionList, clientId, listId, name, date_format, file_format, status, fields_selected, ONGAGE_USERNAME, ONGAGE_PASSWORD, ONGAGE_ACCOUNT, segmentIdss);
                    const filename = path.basename(filePath);
                    const baseURL = `http://megan.lopsolutions.com/api/upload/Master/${clientId}/`;
                    const currentDateForPath = format(new Date(), 'yyyy-MM-dd');
                    const fileLivePath = `${baseURL}${currentDateForPath}/Remove/${filename}`;

                    const dataForRemove = {
                        list_id: masterSuppressionList,
                        file_url: fileLivePath,
                        csv_delimiter: ",",
                        import_type: "suppression",
                        import_action: "remove"
                    };

                    var start_date=new Date();

                    const remove = await axios({
                        method: "POST",
                        url: `https://api.ongage.net/${listId}/api/import`,
                        data: dataForRemove,
                        headers: {
                            'X_USERNAME': ONGAGE_USERNAME,
                            'X_PASSWORD': ONGAGE_PASSWORD,
                            'X_ACCOUNT_CODE': ONGAGE_ACCOUNT,
                            'Content-Type': 'application/json'
                        }
                    });

                    const importId = remove.data.payload.id;
                    const finalStatus = await checkImportStatus(listId, importId);
                        
                    var ended_date = new Date();    
                    
                    if (finalStatus === 'Completed') {
                        logger.info('Import process completed successfully.');
                    } else if (finalStatus === 'Invalid') {
                        logger.error('Import process failed due to invalid status.');
                    }
                    
                    await addMasterSuppressionExportLog(1,start_date, ended_date,clientId,listId,segmentIdss,masterSuppressionList,"Remove Import", dataForRemove,remove.data.payload,finalStatus,"");
                    
                    
                }

                const currentDate_name = format(new Date(), 'yyyyMMdd_HHmmss');
                const name = `master_Export_${listId}_${currentDate_name}`;

                if (!name || !date_format || !file_format || !segmentIdss || !status) {
                    return res.status(412).json({
                        error: 'Invalid Data',
                        message: 'Missing required parameters'
                    });
                }

                const filePath = await processExport(subUploadFolderPath, masterSuppressionList, clientId, listId, segmentIdss, name, date_format, file_format, status, fields_selected, ONGAGE_USERNAME, ONGAGE_PASSWORD, ONGAGE_ACCOUNT, clientId);
                const filename = path.basename(filePath);
                const baseURL = `http://megan.lopsolutions.com/api/upload/Master/${clientId}/`;
                const currentDateForPath = format(new Date(), 'yyyy-MM-dd');
                const fileLivePath = `${baseURL}${currentDateForPath}/Add/${filename}`;

                const dataForAdd = {
                    list_id: masterSuppressionList,
                    file_url: fileLivePath,
                    csv_delimiter: ",",
                    import_type: "suppression",
                    import_action: "add"
                };

                const add = await axios({
                    method: "POST",
                    url: `https://api.ongage.net/${listId}/api/import`,
                    data: dataForAdd,
                    headers: {
                        'X_USERNAME': ONGAGE_USERNAME,
                        'X_PASSWORD': ONGAGE_PASSWORD,
                        'X_ACCOUNT_CODE': ONGAGE_ACCOUNT,
                        'Content-Type': 'application/json'
                    }
                });

                const importId = add.data.payload.id;
                const finalStatus = await checkImportStatus(listId, importId);
                
                 const EndedDate_name = format(new Date(), 'yyyyMMdd_HHmmss');
                
                if (finalStatus === 'Completed') {
                    logger.info('Import process completed successfully.');
                    await removeUploadFolder(clientId);
                } else if (finalStatus === 'Invalid') {
                    logger.error('Import process failed due to invalid status.');
                }
                  await addMasterSuppressionExportLog(1,currentDate_name, EndedDate_name,clientId,listId,segmentIdss,masterSuppressionList,"Add Import", dataForAdd,add.data.payload,finalStatus,"");
            }
      //  }
        res.status(200).json({
            success: true,
            message: 'Export completed successfully'
        });
    } catch (error) {
        logger.error('Error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: error.message
        });
    }
});

async function removeUploadFolder(client_id) {
    try {
        const uploadDir = path.join(`${CSV_FILE_PATH}`, 'upload');
        const MeganDir = path.join(uploadDir, "Master");
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


async function checkImportStatus(listId, importId) {
    const importStatusUrl = `https://api.ongage.net/${listId}/api/import/${importId}`;

    let status = '';
    do {
        try {
            const response = await axios.get(importStatusUrl, {
                headers: {
                    'X_USERNAME': ONGAGE_USERNAME,
                    'X_PASSWORD': ONGAGE_PASSWORD,
                    'X_ACCOUNT_CODE': ONGAGE_ACCOUNT,
                    'Content-Type': 'application/json'
                }
            });

            status = response.data.payload.status_desc;
            logger.info(`Import Status for ${importId}: ${status}`);

            // Check status every 5 seconds
            await delay(10000);
        } catch (error) {
            logger.error('Error:', error);
            throw error;
        }
    } while (status !== 'Completed' && status !== 'Invalid');

    return status;
}

async function processExportForRemove(RemoveUploadFolderPath, Export_Id, clientId, listId, name, date_format, file_format, status, fields_selected, ONGAGE_USERNAME, ONGAGE_PASSWORD, ONGAGE_ACCOUNT, segmentIdss) {
    const exportData = {
        name,
        date_format,
        file_format,
        status,
        fields_selected
    };
    console.log(segmentIdss);
    var start_date=new Date();
    
    const createExportResponse = await run('POST', `${ONGAGE_API_URL}/${Export_Id}/api/export`, exportData, ONGAGE_USERNAME, ONGAGE_PASSWORD, ONGAGE_ACCOUNT);
    const exportId = createExportResponse.data.payload.id;
    
    var Ongage_response_log=createExportResponse.data.payload;

    let exportCompleted = false;
    const startDate = new Date();
    let statusData1;
    while (!exportCompleted) {
        const getStatusResponse = await run_get('GET', `${ONGAGE_API_URL}/${Export_Id}/api/export/${exportId}`, "", ONGAGE_USERNAME, ONGAGE_PASSWORD, ONGAGE_ACCOUNT);
        statusData1 = {
            status: getStatusResponse.status,
            status_file: getStatusResponse.data.payload.status_desc
        };
        logger.info(`${listId}=${statusData1.status_file}`);
        if (statusData1.status_file === 'Completed') {
            exportCompleted = true;
        } else {
            await delay(30000);
        }
    }
    
    var ended_date=new Date();

    const retrieveResponse = await run_get('GET', `${ONGAGE_API_URL}/api/export/${exportId}/retrieve`, 'arraybuffer', ONGAGE_USERNAME, ONGAGE_PASSWORD, ONGAGE_ACCOUNT);
    const zip = new AdmZip(retrieveResponse.data);
    const zipEntries = zip.getEntries();
    const firstEntry = zipEntries[0];
    const fileBuffer = firstEntry.getData();
    const csvContent = fileBuffer.toString();
    const csvString = csvContent.split('\n').map(row => row.split(',')).map(row => row[0]).join('\r\n');
    
    var fileName_log=`${name}_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`;

    const csvFilePath = path.join(RemoveUploadFolderPath, `${name}_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);

    fs.writeFileSync(csvFilePath, csvString, { encoding: 'utf8' });
    
        await addMasterSuppressionExportLog(1,start_date, ended_date,clientId,listId,segmentIdss,Export_Id,"Remove Export", exportData,Ongage_response_log,statusData1.status_file,fileName_log);

    return csvFilePath;
}

async function processExport(subUploadFolderPath, masterSuppressionList, clientId, listId, segmentIdss, name, date_format, file_format, status, fields_selected, ONGAGE_USERNAME, ONGAGE_PASSWORD, ONGAGE_ACCOUNT, clientId) {
    const exportData = {
        name,
        date_format,
        file_format,
        segment_id: segmentIdss,
        status,
        fields_selected
    };
        logger.info(exportData);
    var start_date=new Date();    
    
    const createExportResponse = await run('POST', `${ONGAGE_API_URL}/${listId}/api/export`, exportData, ONGAGE_USERNAME, ONGAGE_PASSWORD, ONGAGE_ACCOUNT);

    const exportId = createExportResponse.data.payload.id;
    
     var Ongage_response_log=createExportResponse.data.payload;

    let exportCompleted = false;
    const startDate = new Date();
    let statusData1;
    while (!exportCompleted) {
        const getStatusResponse = await run_get('GET', `${ONGAGE_API_URL}/${listId}/api/export/${exportId}`, "", ONGAGE_USERNAME, ONGAGE_PASSWORD, ONGAGE_ACCOUNT);
        statusData1 = {
            status: getStatusResponse.status,
            status_file: getStatusResponse.data.payload.status_desc
        };
        logger.info(`${listId}=${statusData1.status_file}`);
        if (statusData1.status_file === 'Completed') {
            exportCompleted = true;
        } else {
            await delay(30000);
        }
    }
    
      var ended_date=new Date();        
        
    const retrieveResponse = await run_get('GET', `${ONGAGE_API_URL}/api/export/${exportId}/retrieve`, 'arraybuffer', ONGAGE_USERNAME, ONGAGE_PASSWORD, ONGAGE_ACCOUNT);
    const zip = new AdmZip(retrieveResponse.data);
    const zipEntries = zip.getEntries();
    const firstEntry = zipEntries[0];
    const fileBuffer = firstEntry.getData();
    const csvContent = fileBuffer.toString();
    const csvString = csvContent.split('\n').map(row => row.split(',')).map(row => row[0]).join('\r\n');
    
    var fileName_log= `${name}_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`;

    const csvFilePath = path.join(subUploadFolderPath, `${name}_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);

    fs.writeFileSync(csvFilePath, csvString, {
        encoding: 'utf8'
    });

    logger.info(csvFilePath);
    
            await addMasterSuppressionExportLog(1,start_date, ended_date,clientId,listId,segmentIdss,masterSuppressionList,"Add Export", exportData,Ongage_response_log,statusData1.status_file,fileName_log);


    return csvFilePath;
}

async function run(sMethod, sUrl, data1, ONGAGE_USERNAME, ONGAGE_PASSWORD, ONGAGE_ACCOUNT) {
    try {
        const response = await axios({
            method: sMethod,
            url: sUrl,
            data: data1,
            headers: {
                'X_USERNAME': ONGAGE_USERNAME,
                'X_PASSWORD': ONGAGE_PASSWORD,
                'X_ACCOUNT_CODE': ONGAGE_ACCOUNT,
                'Content-Type': 'application/json'
            }
        });
        return response;
    } catch (error) {
        logger.error('Error object:', error);
        throw error;
    }
}

async function run_get(sMethod, sUrl, responseType, ONGAGE_USERNAME, ONGAGE_PASSWORD, ONGAGE_ACCOUNT) {
    if (responseType) {
        try {
            const response = await axios({
                method: sMethod,
                url: sUrl,
                responseType: responseType,
                headers: {
                    'X_USERNAME': ONGAGE_USERNAME,
                    'X_PASSWORD': ONGAGE_PASSWORD,
                    'X_ACCOUNT_CODE': ONGAGE_ACCOUNT,
                    'Content-Type': 'application/json'
                }
            });
            return response;
        } catch (error) {
            logger.error('Error object:', error);
            throw error;
        }
    } else {
        try {
            const response = await axios({
                method: sMethod,
                url: sUrl,
                headers: {
                    'X_USERNAME': ONGAGE_USERNAME,
                    'X_PASSWORD': ONGAGE_PASSWORD,
                    'X_ACCOUNT_CODE': ONGAGE_ACCOUNT,
                    'Content-Type': 'application/json'
                }
            });
            return response;
        } catch (error) {
            logger.error('Error object:', error);
            throw error;
        }
    }
}

module.exports = router;
