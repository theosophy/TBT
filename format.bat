@echo off

for /R src/manwhw/chapters %%F in (*.xml) do (
    echo Formatting %%F
    cscript //NoLogo format.js /src:%%F /res:%%F
)
