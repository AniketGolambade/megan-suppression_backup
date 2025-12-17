const mysql = require('mysql');
const crypto = require('crypto');
const fs = require('fs');

const con = mysql.createConnection({
    host: "localhost",
    user: "megan_megan",
    password: "Megan@@!@#123",
    database: "megan_megan"
});

con.connect(function (err) {
    if (err) throw err;
    console.log("Connected to MySQL!");
});


//----------------------------------MASTER--------------------------------------------

  const listSegmentDataMaster = [{
            clientId: "5516",
            lists: [
                {
                listId: 148624,
                segmentIds: [1144549418, 1144540457, 1144540456],
                masterSuppressionList: 222074
            }
            //,
            // {
            //     listId: 45700,
            //     segmentIds: [1080064413	,1080064404,1080064385],
            //     masterSuppressionList: 132337
            // }
            ]
            
        }];

function addMasterSuppressionExportLog(srNo,createdDate, endDate, clientId, listId, segmentIds, masterSuppressionListId, listStatus, ongageRequest, ongageResponse, status, fileName) {
    return new Promise((resolve, reject) => {
        const sql = "INSERT INTO master_suppression_export_log (srNo,created_date, end_date, client_id, list_id, segment_ids, Master_suppression_list_id, list_status, ongage_request, ongage_response, status, file_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?)";
        con.query(sql, [srNo,createdDate, endDate, clientId, listId,JSON.stringify(segmentIds) , masterSuppressionListId, listStatus, JSON.stringify( ongageRequest), JSON.stringify(ongageResponse), status, fileName], (err, result) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
}

function removeSegmentDataFromDatabase(clientId, listId) {
    return new Promise((resolve, reject) => {
        const deleteQuery = "DELETE FROM list_segment_data_master WHERE clientId = ? AND listId = ?";
        con.query(deleteQuery, [clientId, listId], (err, result) => {
            if (err) {
                reject(err);
                console.error('Error removing data:', err);
            } else {
                resolve("Data removed successfully");
                console.log('Data removed successfully');
            }
        });
    });
}
function addSegmendDataMasterToDatabase(clientId, listId, segmentIds, masterSuppressionList) {
    return new Promise((resolve, reject) => {
        console.log(segmentIds);
        const InsertQueryForMaster = "INSERT INTO list_segment_data_master (clientId, listId, segmentIds, masterSuppressionList) VALUES (?, ?, ?, ?)";
        con.query(InsertQueryForMaster, [clientId, listId, JSON.stringify(segmentIds), masterSuppressionList], (updateErr, updateResult) => {
            if (updateErr) {
                reject(updateErr);
                console.log(updateErr);
            } else {
                resolve("Entry updated with new updated_dt");
            }
        });
    });
}

function getSegmendDataMasterFromDatabase(callback) {
    con.query('SELECT * FROM list_segment_data_master', function (err, results) {
        if (err) {
            callback(err, null);
        } else {
            callback(null, results);
        }
    });
}
 function getSegmendDataMasterFromDatabaseForApi() {
            // return new Promise((resolve, reject) => {
            //     con.query('SELECT * FROM list_segment_data_master', function (err, results) {
            //         if (err) {
            //             reject(err);
            //         } else {
            //             resolve(results);
            //         }
            //     });
            // });
             return new Promise((resolve, reject) => {
                const query = 'SELECT * FROM list_segment_data_master WHERE status = 1 AND deleted = 0';
                con.query(query, ['Active'], (err, results) => {
                    if (err) {
                        reject(err);
                        console.error('Error fetching data:', err);
                    } else {
                        resolve(results);
                    }
                });
            });
        }

// function getSrNo(callback) {
//     con.query('SELECT Srno FROM list_segment_data_master ORDER BY id DESC LIMIT 1', function (err, results) {
//         if (err) {
//             callback(err, null);
//         } else {
//             if (results.length > 0) {
//                 callback(null, results[0].Srno);
//             } else {
//                 callback(null, 0);
//             }
//         }
//     });
// }

//-----------------------------------Megan---------------------------------------------

const listSegmentData = [
            { list_id: 141004, segment_id: 1080874304 },
            { list_id: 33877, segment_id: 1080874300 },
            { list_id: 118305, segment_id: 1080874306 },
            { list_id: 167263, segment_id: 1110031866 },
            { list_id: 140999, segment_id: 1080874307 },
            { list_id: 141001, segment_id: 1080874308 },
            { list_id: 39592, segment_id: 1080874310 },
            { list_id: 141003, segment_id: 1080874312 },
            { list_id: 44433, segment_id: 1123064735 },
            { list_id: 34015, segment_id: 1080874314 },
            { list_id: 75376, segment_id: 1080874315 },
            { list_id: 41814, segment_id: 1080874318 },
            { list_id: 39594, segment_id: 1080874319 },
            { list_id: 88203, segment_id: 1080874320 },
            { list_id: 82021, segment_id: 1123064736 },
            { list_id: 35793, segment_id: 1080874325 },
            { list_id: 138107, segment_id: 1080874328 },
            { list_id: 88204, segment_id: 1080874329 },
            { list_id: 148097, segment_id: 1092605146 },
            { list_id: 140639, segment_id: 1080874337 },
            { list_id: 141000, segment_id: 1080874321 },
            { list_id: 141005, segment_id: 1080874322 }
        ];

function insertExportData(client_id, list_id, segment_id) {
    return new Promise((resolve, reject) => {
        const sql = "INSERT INTO export_details (client_id, list_id, segment_id, date) VALUES (?, ?, ?, CURDATE())";
        con.query(sql, [client_id, list_id, segment_id], (err, result) => {
            if (err) {
                reject(err);
            } else {
                resolve({ id: result.insertId, result });
            }
        });
    });
}

function checkExportDataExists(clientId, listId, segmentIds, date) {
    return new Promise((resolve, reject) => {
        const sql = "SELECT COUNT(*) AS count FROM export_details WHERE client_id = ? AND list_id = ? AND segment_id = ? AND date = ?";
        con.query(sql, [clientId, listId, segmentIds, date], (err, result) => {
            if (err) {
                reject(err);
            } else {
                const count = result[0].count;
                if (count > 0) {
                    resolve(true);
                } else {
                    resolve(false);
                }
            }
        });
    });
}

function addExportLog(exportId, startDate, finishDate, ongageResponse, ongageRequest, status, parent_id) {
    return new Promise((resolve, reject) => {
        const sql = "INSERT INTO export_log (export_id, start_datetime, finish_datetime, ongage_response, ongage_request, status,parent_id) VALUES (?, ?, ?, ?, ?, ?,?)";
        con.query(sql, [exportId, startDate, finishDate, JSON.stringify(ongageResponse), JSON.stringify(ongageRequest), status, parent_id], (err, result) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
}

function addExportFilename(client_id, filename, zip_file) {
    return new Promise((resolve, reject) => {
        const sql = "INSERT INTO export_filename (client_id, file_name, zip_file) VALUES (?, ?, ?)";
        con.query(sql, [client_id, filename, zip_file], (err, result) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
}

function addExportData(list_id, segment_id, created_dt, updated_dt) {
    return new Promise((resolve, reject) => {
        var client_id = "5516";
        const checkQuery = "SELECT * FROM tbl_lists_data WHERE client_id = ? AND list_id = ?";
        con.query(checkQuery, [client_id, list_id], (checkErr, checkResult) => {
            if (checkErr) {
                reject(checkErr);
            } else {
                if (checkResult.length === 0) {
                    const insertQuery = "INSERT INTO tbl_lists_data (client_id, list_id, segment_id, created_dt, updated_dt) VALUES (?, ?, ?, ?, ?)";
                    con.query(insertQuery, [client_id, list_id, segment_id, created_dt, updated_dt], (insertErr, insertResult) => {
                        if (insertErr) {
                            reject(insertErr);
                        } else {
                            resolve(insertResult);
                        }
                    });
                } else {
                    const updateQuery = "UPDATE tbl_lists_data SET updated_dt = ? WHERE client_id = ? AND list_id = ?";
                    con.query(updateQuery, [updated_dt, client_id, list_id], (updateErr, updateResult) => {
                        if (updateErr) {
                            reject(updateErr);
                        } else {
                            resolve("Entry updated with new updated_dt");
                        }
                    });
                }
            }
        });
    });
}

function getListSegmentData() {
    return new Promise((resolve, reject) => {
        const query = "SELECT list_id, segment_id FROM tbl_lists_data";
        con.query(query, (err, results) => {
            if (err) {
                reject(err);
            } else {
                const listSegmentData = results.map(row => ({
                    list_id: row.list_id,
                    segment_id: row.segment_id
                }));
                resolve(listSegmentData);
            }
        });
    });
}


function getUserCredentials(account_id) {
  return new Promise((resolve, reject) => {
    const query = `SELECT username, account_code, password FROM usermeta WHERE account_id = ? AND status = 1`;
    con.query(query, [account_id], (err, results) => {
      if (err) {
        reject(err);
      } else {
        if (!results || results.length === 0 || !results[0]) {
          reject(new Error('Account not found'));
        } else {
          resolve(results[0]);
        }
      }
    });
  });
}

//--------------------------Megan Ui----------------------------------------

function login(username, passwordmd5, callback) {
        
    let password = crypto.createHash('md5').update(passwordmd5).digest('hex');

    con.query('SELECT * FROM users WHERE email = ? AND password = ?', [username, password], function(err, results) {
        if (err) {
            callback(err, null);
        } else {
            if (results.length > 0) {
                callback(null, results[0]);
            } else {
                callback(new Error('Invalid username or password'), null);
            }
        }
    });
}

function getUsersFromDatabase(callback) {
    con.query('SELECT * FROM export_filename', function(err, results) {
        if (err) {
            callback(err, null);
        } else {
            callback(null, results);
        }
    });
}

function getDatabaseLogsFromDatabase(clientId, date) {
    return new Promise((resolve, reject) => {
        con.query('SELECT client_id, list_id, date FROM export_details WHERE client_id = ? AND date = ?', [clientId, date], (err, results) => {
            if (err) {
                reject(err);
            } else {
                resolve(results);
            }
        });
    });
}

const directoryPath = '/home/megan/public_html';
    
const permissions = 0777;

// fs.access(directoryPath, fs.constants.F_OK, (err) => {
//     if (err) {
//         console.error("Directory does not exist.");
//         return;
//     }

//     fs.chmod(directoryPath, permissions, (chmodErr) => {
//         if (chmodErr) {
//             console.error("Failed to update permissions for directory:", chmodErr);
//         } else {
//             console.log("Permissions updated successfully for directory.");
//         }
//     });
// });
fs.access(directoryPath, fs.constants.F_OK, (err) => {
    if (err) {
        console.error("Error accessing directory:", err);
        return;
    }

    fs.chmod(directoryPath, permissions, (chmodErr) => {
        if (chmodErr) {
            console.error("Error updating permissions for directory:", chmodErr);
        } else {
            console.log("Permissions updated successfully for directory.");
        }
    });
});

function updateStatusFromDatabase(clientId, listId, status) {
    return new Promise((resolve, reject) => {
        const updateQuery = "UPDATE list_segment_data_master SET status = ? WHERE clientId = ? AND listId = ?";
        con.query(updateQuery, [status, clientId, listId], (err, result) => {
            if (err) {
                reject(err);
                console.error('Error updating status:', err);
            } else {
                resolve("Status updated successfully");
                console.log('Status updated successfully');
            }
        });
    });
}
function updateDataFromDatabase(clientId, listId, segmentIds, masterSuppressionList, status, id) {
    return new Promise((resolve, reject) => {
        const updateQuery = "UPDATE list_segment_data_master SET segmentIds = ?, masterSuppressionList = ?, status = ?, clientId = ?, listId = ?  WHERE id = ?";
        con.query(updateQuery, [segmentIds, masterSuppressionList, status, clientId, listId, id], (err, result) => {
            if (err) {
                reject(err);
                console.error('Error updating status:', err);
            } else {
                resolve("Status updated successfully");
                console.log('Status updated successfully');
            }
        });
    });
}



module.exports = {  con,listSegmentData,listSegmentDataMaster ,insertExportData, addExportLog, checkExportDataExists, addExportFilename, addExportData, getListSegmentData,
login,getUsersFromDatabase,getDatabaseLogsFromDatabase,addMasterSuppressionExportLog,removeSegmentDataFromDatabase,addSegmendDataMasterToDatabase,getSegmendDataMasterFromDatabase,
getSegmendDataMasterFromDatabaseForApi,updateStatusFromDatabase,updateDataFromDatabase,getUserCredentials };


