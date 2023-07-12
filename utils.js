import { execFileSync, execSync } from 'child_process';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { intermediateScreenshotsPath, destinationPath } from './constants/constants.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import fs from 'fs-extra';
import crypto from 'crypto';

import constants from './constants/constants.js';
import { silentLogger } from './logs.js';

export const getVersion = () => {
  const loadJSON = path => JSON.parse(fs.readFileSync(new URL(path, import.meta.url)));
  const versionNum = loadJSON('./package.json').version;

  return versionNum;
};

export const getHost = url => new URL(url).host;

export const getCurrentDate = () => {
  const date = new Date();
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
};

export const isWhitelistedContentType = contentType => {
  const whitelist = ['text/html'];
  return whitelist.filter(type => contentType.trim().startsWith(type)).length === 1;
};

export const getStoragePath = (randomToken) => {
  if (constants.exportDirectory === process.cwd()) {
    return `results/${randomToken}_${constants.urlsCrawledObj.scanned.length}pages`; 
  } else {
    if (!path.isAbsolute(constants.exportDirectory)) {
      constants.exportDirectory = path.resolve(process.cwd(), constants.exportDirectory);
    }
    return `${constants.exportDirectory}/${randomToken}_${constants.urlsCrawledObj.scanned.length}pages`;
  }
}
  
export const createDetailsAndLogs = async (scanDetails, randomToken) => {
  const storagePath = getStoragePath(randomToken);
  const logPath = `logs/${randomToken}`;
  await fs.ensureDir(storagePath);
  await fs.writeFile(`${storagePath}/details.json`, JSON.stringify(scanDetails, 0, 2));

  // update logs
  await fs.ensureDir(logPath);
  await fs.pathExists('errors.txt').then(async exists => {
    if (exists) {
      await fs.copy('errors.txt', `${logPath}/${randomToken}.txt`);
    }
  });
};

export const createAndUpdateResultsFolders = async randomToken => {
  const storagePath = getStoragePath(randomToken);
  await fs.ensureDir(`${storagePath}/reports`);
  await fs.copy(
    `${randomToken}/datasets/${randomToken}`,
    `${storagePath}/${constants.allIssueFileName}`,
  );
};

export const createScreenshotsFolder = randomToken => {
  const storagePath = getStoragePath(randomToken);
  if (fs.existsSync(intermediateScreenshotsPath)) {
    fs.readdir(intermediateScreenshotsPath, (err, files) => {
      if (err) {
        console.log('Screenshots were not moved successfully: ' + err.message);
      }

      if (!fs.existsSync(destinationPath(storagePath))) {
        fs.mkdirSync(destinationPath(storagePath), err => {
          if (err) {
            console.log('Screenshots folder was not created successfully: ' + err.message);
          }
        });
      }

      files.forEach(file => {
        fs.renameSync(
          `${intermediateScreenshotsPath}/${file}`,
          `${destinationPath(storagePath)}/${file}`,
        );
      });

      fs.rmdir(intermediateScreenshotsPath, err => {
        if (err) {
          console.log(err);
        }
      });
    });
  }
};

export const cleanUp = async (pathToDelete, setDefaultFolders = false) => {
  await fs.pathExists(pathToDelete).then(exists => {
    if (exists) {
      fs.removeSync(pathToDelete);
    }
  });
};

/* istanbul ignore next */
export const getCurrentTime = () =>
  new Date().toLocaleTimeString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour12: true,
    hour: 'numeric',
    minute: '2-digit',
  });

export const setHeadlessMode = isHeadless => {
  if (isHeadless) {
    process.env.CRAWLEE_HEADLESS = 1;
  } else {
    process.env.CRAWLEE_HEADLESS = 0;
  }
};

export const setThresholdLimits = setWarnLevel => {
  process.env.WARN_LEVEL = setWarnLevel;
};

export const zipResults = (zipName, resultsPath) => {
  // Check prior zip file exist and remove
  if (fs.existsSync(zipName)) {
    fs.unlinkSync(zipName);
  }

  if (os.platform() === 'win32') {
    try {
      execSync(
        `Get-ChildItem -Path "${resultsPath}\\*.*" -Recurse | Compress-Archive -DestinationPath "${zipName}"`,
        { shell: 'powershell.exe' },
      );
    } catch (err) {
      throw err;
    }
  } else {
    // To zip up files recursively )-r) in the results folder path
    // Will only zip up the content of the results folder path with (-j) i.e. junk the path
    const command = '/usr/bin/zip';
    const args = ['-r', '-j', zipName, resultsPath];
    try {
      execFileSync(command, args);
    } catch (err) {
      throw err;
    }
  }
};
