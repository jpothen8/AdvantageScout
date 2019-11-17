// Responsible for managing communication with the server on mobile app
function AppServerManager(appManager) {
    var serialQueue = []
    
    // Start sending heartbeats regularly
    this.initHeartbeatLoop = function() {
        this.heartbeat()
        this.upload()
        setInterval(function() {appManager.serverManager.heartbeat(); appManager.serverManager.upload()}, 20000)
    }
    
    // Send heartbeat if not already in queue
    var heartbeatQueued = false
    this.heartbeat = function() {
        if (!heartbeatQueued) {
            heartbeatQueued = true
            addToSerialQueue("heartbeat", function() {
                             if (appManager.state == 0) {
                             return [appManager.state]
                             } else {
                             return [appManager.state, appManager.team, appManager.match]
                             }
                             }, function() {
                             heartbeatQueued = false
                             })
        }
    }
    
    // Upload saved matches
    var uploadQueued = false
    var imageCache = {}
    var imageCacheTarget = 0
    var lastLocalStorage = "[]"
    this.upload = function() {
        if (JSON.parse(window.localStorage.getItem("advantagescout_scoutdata")).length > 0 && window.localStorage.getItem("advantagescout_scoutdata") != lastLocalStorage) {
            var imageQueue = getCacheQueue()
            imageCache = {}
            imageCacheTarget = imageQueue.length
            if (imageQueue.length > 0) {
                for (var z = 0; z < imageQueue.length; z++) {
                    readImage(imageQueue[z], function(imageData, fileName) {
                              imageCache[fileName] = imageData
                              
                              if (Object.keys(imageCache).length == imageCacheTarget) {
                              lastLocalStorage = window.localStorage.getItem("advantagescout_scoutdata")
                              send()
                              }
                              })
                }
            } else {
                lastLocalStorage = window.localStorage.getItem("advantagescout_scoutdata")
                send()
            }
            
            function send() {
                if (!uploadQueued) {
                    uploadQueued = true
                    addToSerialQueue("upload", getUploadData, function(data) {
                                     uploadQueued = false
                                     lastLocalStorage = "[]"
                                     var response = JSON.parse(data)[1]
                                     if (response.success) {
                                     var stored = JSON.parse(window.localStorage.getItem("advantagescout_scoutdata"))
                                     stored.splice(0, response.count)
                                     window.localStorage.setItem("advantagescout_scoutdata", JSON.stringify(stored))
                                     }
                                     appManager.settingsManager.updateLocalCount()
                                     })
                }
            }
        }
        appManager.settingsManager.updateLocalCount()
    }
    
    // Process local storage data to get file paths
    function getCacheQueue() {
        var output = []
        var localData = JSON.parse(window.localStorage.getItem("advantagescout_scoutdata"))
        for (var i = 0; i < localData.length; i++) {
            var fields = Object.keys(localData[i])
            for (var f = 0; f < fields.length; f++) {
                var value = localData[i][fields[f]]
                if (value.length > 8) {
                    if (value.slice(0, 8) == "file:///") {
                        output.push(value)
                    }
                }
            }
        }
        return output
    }
    
    // Get image file as base 64
    function readImage(path, callback){
        window.resolveLocalFileSystemURL(path, onSuccess, function() {});
        
        function onSuccess(fileEntry) {
            fileEntry.file(function(file) {
                           var reader = new FileReader();
                           reader.onloadend = function(e) {
                           var content = this.result;
                           callback(String(content), this["_localURL"].split("/").pop());
                           }
                           reader.readAsDataURL(file);
                           })
        }
    }
    
    // Process local storage data for upload (insert images from cache)
    function getUploadData() {
        var localData = JSON.parse(window.localStorage.getItem("advantagescout_scoutdata"))
        for (var i = 0; i < localData.length; i++) {
            var fields = Object.keys(localData[i])
            for (var f = 0; f < fields.length; f++) {
                var value = localData[i][fields[f]]
                var fileName = String(value).split("/").pop()
                if (imageCache[fileName] != undefined) {
                    localData[i][fields[f]] = imageCache[fileName]
                }
            }
        }
        return [JSON.stringify(localData)]
    }
    
    // Get config and game data from server
    var loadDataQueued = false
    this.getData = function() {
        if (!loadDataQueued) {
            loadDataQueued = true
            addToSerialQueue("load_data", function() {return []}, function(data) {
                             loadDataQueued = false
                             data = JSON.parse(data)[1]
                             if (data.schedule == undefined) {
                             data.schedule = []
                             data.config.use_schedule = false
                             }
                             appManager.loadData(data.config, data.game, data.schedule, data.version, false)
                             })
        }
    }
    
    // Report if connected to server
    this.connected = function() {
        return true
    }

    // Add item to queue and push if needed
    function addToSerialQueue(query, args, response) {
        serialQueue.push({"query": query, "args": args, "response": response})
        if (serialQueue.length == 1) {
            pushSerialQueue()
        }
    }
    
    // Get length of time to wait after failed communication
    function getRetryDelay() {
        return (Math.random() * 6000) + 5000
    }
    
    // Disconnect and try again
    function timeoutPushSerialQueue() {
        try {
            bluetoothSerial.unsubscribe()
            bluetoothSerial.disconnect()
        }
        catch(error) {
            x = 0
        }
        appManager.settingsManager.hideUploadProgress()
        setTimeout(function() {pushSerialQueue()}, getRetryDelay())
    }
    
    // Send items in serial queue to server
    var timeout
    function pushSerialQueue() {
        var responses = []
        bluetoothSerial.isEnabled(function(){
                                  btEnabled()
                                  }, function() {
                                  setTimeout(function() {pushSerialQueue()}, getRetryDelay())
                                  })
        function btEnabled() {
            if (window.localStorage.getItem("advantagescout_device") == null || window.localStorage.getItem("advantagescout_server") == null || window.localStorage.getItem("advantagescout_device") == "" || window.localStorage.getItem("advantagescout_server") == "") {
                setTimeout(function() {pushSerialQueue()}, getRetryDelay())
            } else {
                timeout = setTimeout(function() {timeoutPushSerialQueue()}, 10000)
                bluetoothSerial.connect(window.localStorage.getItem("advantagescout_server"), function() {
                                        clearTimeout(timeout)
                                        function loadData() {
                                            data = JSON.stringify([window.localStorage.getItem("advantagescout_device"), serialQueue[0].query, serialQueue[0].args()])
                                            serialWrite(data, onReceived)
                                        }
                                        
                                        function onReceived(data) {
                                            serialQueue.shift().response(data)
                                            if (serialQueue.length == 0) {
                                                bluetoothSerial.unsubscribe()
                                                bluetoothSerial.disconnect()
                                            } else {
                                                loadData()
                                            }
                                        }
                                        
                                        loadData()
                                        }, function() {
                                        clearTimeout(timeout)
                                        timeoutPushSerialQueue()
                                        })
            }
        }
    }
    
    // Writes data in pieces to server
    var continueQueue = []
    var continueQueueLength
    var sendResponse
    var breakFrequency = 2000 // how many bytes at a time?
    function serialWrite(data, callback) {
        sendResponse = callback
        
        // Break up data
        continueQueue = []
        var dataLeft = data
        while (dataLeft.length > breakFrequency) {
            continueQueue.push(dataLeft.slice(0, breakFrequency) + "CONT")
            dataLeft = dataLeft.slice(breakFrequency)
        }
        continueQueue.push(dataLeft)
        continueQueueLength = continueQueue.length
        
        // Send data
        bluetoothSerial.clear()
        bluetoothSerial.subscribe("\n", function(data) {
                                  clearTimeout(timeout)
                                  if (data.slice(-5) == "CONT\n") {
                                  var length = continueQueueLength
                                  appManager.settingsManager.setUploadProgress(length - continueQueue.length, length)
                                  bluetoothSerial.write(continueQueue.shift() + "\n", function() {}, function() {})
                                  timeout = setTimeout(function() {timeoutPushSerialQueue()}, 10000)
                                  } else {
                                  appManager.settingsManager.hideUploadProgress()
                                  sendResponse(data)
                                  }
                                  })
        if (continueQueueLength > 1) {
            appManager.settingsManager.setUploadProgress(0, continueQueueLength)
        }
        bluetoothSerial.write(continueQueue.shift() + "\n", function() {}, function() {})
        timeout = setTimeout(function() {timeoutPushSerialQueue()}, 10000)
    }
}
