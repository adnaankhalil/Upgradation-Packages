FOR /R "C:\Program Files (x86)\Apache Software Foundation\CouchDB\var\lib\couchdb" %%F in (*.*) do %~dp0\Bell-Installer-for-Windows\curl -X DELETE http://admin:password@localhost:5984/%%~nF

call %~dp0\Bell-Installer-for-Windows\Executables\node-v0.10.35-x64.msi

call "C:\Program Files (x86)\Apache Software Foundation\CouchDB\unins000.exe"

rmdir "C:\Program Files (x86)\Apache Software Foundation" /s /q
