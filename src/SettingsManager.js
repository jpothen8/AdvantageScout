// Responsible for managing settings
function SettingsManager(appManager) {
    var cacheExpiration = 86400 //time to allow use of cached game data/config/version (seconds)
    
    // Retrieve app version number from cordova
    var appVersion = ""
    var appVersionRemote = ""
    var outdatedAlertSent = false
    this.loadVersion = function() {
        if (!appManager.web) {
            cordova.getAppVersion.getVersionNumber(function(version) {
                                                   document.getElementsByClassName("versiontext")[0].innerHTML = "Version " + version.toString()
                                                   appVersion = version.toString()
                                                   if (appVersionRemote != "" && appVersionRemote != appVersion && !outdatedAlertSent) {
                                                   outdatedAlertSent = true
                                                   appManager.notificationManager.alert("Update Required", "This app version is outdated. Ask the scouting team for help updating.")
                                                   }
                                                   })
        }
    }
    
    // Return current app version
    this.getVersion = function() {
        return appVersion
    }
    
    // Check version from server and alert if outdated
    this.checkVersion = function(checkVersion) {
        if (!appManager.web) {
            appVersionRemote = checkVersion
            if (appVersion != "") {
                this.loadVersion()
            }
        }
    }
    
    // Check if device name exists and open settings or write to text box
    this.checkDeviceName = function() {
        if (window.localStorage.getItem("advantagescout_device") == null) {
            this.open()
        } else if (!appManager.web) {
            document.getElementById("name").value = window.localStorage.getItem("advantagescout_device")
        }
    }
    
    // Update list of paired bluetooth devices
    this.refreshDeviceList = function() {
        if (!appManager.web) {
            bluetoothSerial.list(function(devices) {
                                 var serverSelect = document.getElementById("server")
                                 serverSelect.innerHTML = ""
                                 for (var i = 0; i < devices.length; i++) {
                                 var option = document.createElement("OPTION")
                                 option.value = devices[i].address
                                 option.innerHTML = devices[i].name
                                 serverSelect.appendChild(option)
                                 }
                                 
                                 if (window.localStorage.getItem("advantagescout_server") != null) {
                                 for (var i = 0; i < devices.length; i++) {
                                 if (devices[i].address == window.localStorage.getItem("advantagescout_server")) {
                                 serverSelect.selectedIndex = i
                                 }
                                 }
                                 }
                                 })
        }
    }
    
    // Create list in local storage for saved matches
    this.initLocalStorage = function() {
        if (window.localStorage.getItem("advantagescout_scoutdata") == null) {
            window.localStorage.setItem("advantagescout_scoutdata", "[]")
        }
        if (window.localStorage.getItem("advantagescout_server") == null) {
            window.localStorage.setItem("advantagescout_server", "")
        }
    }
    
    // Write config and game into local storage
    this.saveDataCache = function(config, game, version) {
        window.localStorage.setItem("advantagescout_datacache", JSON.stringify({"config": config, "game": game, "version": version}))
        window.localStorage.setItem("advantagescout_datacachetimestamp", Math.round(Date.now() / 1000))
    }
    
    // Read config and game from local storage (if not expired)
    this.loadDataCache = function() {
        if (window.localStorage.getItem("advantagescout_datacache") != null) {
            if (Math.round(Date.now() / 1000) - window.localStorage.getItem("advantagescout_datacachetimestamp") < cacheExpiration) {
                var parsed = JSON.parse(window.localStorage.getItem("advantagescout_datacache"))
                appManager.loadData(parsed.config, parsed.game, parsed.version, true)
            }
        }
    }
    
    // Update local saved count on selection screen
    this.updateLocalCount = function() {
        if (!uploadLock) {
            var count = JSON.parse(window.localStorage.getItem("advantagescout_scoutdata")).length
            if (count == 0) {
                document.getElementById("localcount").innerHTML = "All matches uploaded"
            } else if (count == 1) {
                document.getElementById("localcount").innerHTML = "1 match saved locally"
            } else {
                document.getElementById("localcount").innerHTML = count + " matches saved locally"
            }
        }
    }
    
    // Display uploading message and percent
    var uploadLock = false
    this.setUploadProgress = function(current, total) {
        uploadLock = true
        var percent = Math.round((current/total)*100).toString()
        document.getElementById("localcount").innerHTML = "Uploading... (" + percent + "%)"
    }
    
    // Switch from upload progress to matches saved display
    this.hideUploadProgress = function() {
        uploadLock = false
        this.updateLocalCount()
    }
    
    // Open settings screen
    this.open = function() {
        if (appManager.web) {
            window.location = "/config"
        } else {
            document.getElementById("selectionDiv").hidden = true
            document.getElementById("configDiv").hidden = false
        }
    }
    
    // Close settings screen
    this.close = function() {
        if (!appManager.web) {
            document.getElementById("selectionDiv").hidden = false
            document.getElementById("configDiv").hidden = true
            window.localStorage.setItem("advantagescout_device", document.getElementById("name").value)
            window.localStorage.setItem("advantagescout_server", document.getElementById("server").value)
            appManager.serverManager.getData()
        }
    }
}
