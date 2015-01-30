::@echo off

:: run couchdb executable/installer wizard
%~dp0\Executables\setup-couchdb-1.5.0_R16B02.exe

:: run couchdb server, in case it was not installed as a service by user
cmd /c %~dp0\Executables\startcouchdb.bat

:: Setting Username and Password for Community
set Username=oleifo
set Password=oleole

:: getting source paths
for /f "tokens=*" %%a in ('dir .\Backup_* /b') do (
	set srcPathConfigurations=%%~fa\Configurations
	set srcPathDatabases=%%~fa\Databases
	set srcPathCouchLogs=%%~fa\CouchLogs
)

:: setting destination paths
set destPathConfigurations="C:\Program Files (x86)\Apache Software Foundation\CouchDB\etc\couchdb"
set destPathDatabases="C:\Program Files (x86)\Apache Software Foundation\CouchDB\var\lib\couchdb"
set destPathCouchLogs="C:\Program Files (x86)\Apache Software Foundation\CouchDB\var\log\couchdb"

:: copy configuration and Log files in new installation
robocopy %srcPathConfigurations% %destPathConfigurations%

:: copy CouchLog in new installation
robocopy %srcPathCouchLogs% %destPathCouchLogs%

:: Restarting CouchDB to activate current configurations
%~dp0\curl -X POST http://localhost:5984/_restart -H "Content-Type: application/json"

timeout 2

:: configure couchdb to be accessible to any node on the LAN
%~dp0\curl -X PUT http://%Username%:%Password%@localhost:5984/_config/httpd/bind_address -d "\"0.0.0.0\""

:: Copy Databases from Backup
robocopy %srcPathDatabases% %destPathDatabases%

:: create databases
FOR /R %~dp0\BeLL-Apps\databases %%F in (*.*) do %~dp0\curl -X PUT http://%Username%:%Password%@localhost:5984/%%~nF
timeout 2

%~dp0\curl -X DELETE http://%Username%:%Password%@localhost:5984/configurations
%~dp0\curl -X DELETE http://%Username%:%Password%@localhost:5984/languages

timeout 2

%~dp0\curl -X PUT http://%Username%:%Password%@localhost:5984/configurations
%~dp0\curl -X PUT http://%Username%:%Password%@localhost:5984/languages

timeout 2

:: add bare minimal required data to couchdb for launching bell-apps smoothly
cd %~dp0
curl -d @Config_Files\languages.txt -H "Content-Type: application/json" -X POST http://%Username%:%Password%@localhost:5984/languages
curl -d @Config_Files\configurations.txt -H "Content-Type: application/json" -X POST http://%Username%:%Password%@localhost:5984/configurations

cd BeLL-Apps
FOR /R .\databases %%F in (*.*) do (
	call node_modules\.bin\couchapp push databases\%%~nF%%~xF http://%Username%:%Password%@localhost:5984/%%~nF
	timeout 1
	)
cd %~dp0\..\

node %~dp0\Schema-Update\app.js
call %~dp0\create_desktop_icon.bat
start firefox http://127.0.0.1:5984/apps/_design/bell/MyApp/index.html#login