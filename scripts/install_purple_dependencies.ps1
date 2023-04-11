# If currently within script, go one directory up
if ((Split-Path -Path $pwd -Leaf) -eq "scripts") {
	cd ..
}

$ProgressPreferences = 'SilentlyContinue'
$ErrorActionPreference = 'Stop'

# Install NodeJS binaries
if (-Not (Test-Path nodejs-win\node.exe)) {
    Write-Output "Downloading Node"
    Invoke-WebRequest -o ./nodejs-win.zip "https://nodejs.org/dist/v18.15.0/node-v18.15.0-win-x64.zip"     
    
    Write-Output "Unzip Node"
    Expand-Archive .\nodejs-win.zip -DestinationPath .
    Rename-Item node-v18.15.0-win-x64 -NewName nodejs-win
    Remove-Item -Force .\nodejs-win.zip
}

# Install Image<agick
if (-Not (Test-Path ImageMagick\bin\compare.exe)) {
    $r=iwr https://imagemagick.org/archive/binaries/ -UseBasicParsing
    $f=$r.Links.href -match "7.*-portable-Q16-x64.zip$"
    Write-Output "Downloading ImageMagick from https://imagemagick.org/archive/binaries/$f"
    Invoke-WebRequest -o ./ImageMagick-win.zip "https://imagemagick.org/archive/binaries/$f"
    Expand-Archive .\ImageMagick-win.zip -DestinationPath ImageMagick\bin
    Remove-Item -Force .\ImageMagick-win.zip
}

# Install Node dependencies
if (Test-Path purple-hats) {
    Write-Output "Installing node dependencies"
    & ".\hats_shell_ps.ps1" "cd purple-hats;npm ci --force"

    if (Test-Path purple-hats\.git) {
        Write-Output "Unhide .git folder"
        attrib -s -h purple-hats\.git
    }

} else {
    Write-Output "Trying to search for package.json instead"

    if (Test-Path package.json) {
        Write-Output "Installing node dependencies"
        & ".\hats_shell_ps.ps1" "npm ci --force"   
    
        if (Test-Path .git) {
            Write-Output "Unhide .git folder"
            attrib -s -h .git
        }

    } else {
        Write-Output "Could not find purple-hats"
    }
}
