import constants, { getExecutablePath, guiInfoStatusTypes } from '../constants/constants.js';
import { spawnSync } from 'child_process';
import { globSync } from 'glob';
import { consoleLogger, guiInfoLog, silentLogger } from '../logs.js';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { createRequire } from 'module';
import os from 'os';
import path from 'path';
import { getPageFromContext } from '../screenshotFunc/pdfScreenshotFunc.js';
import { isFilePath } from '../constants/common.js';

const require = createRequire(import.meta.url);

// CONSTANTS

// Classes
class TranslatedObject {
  goodToFix: {
    rules: any; // You can specify the type for rules if known
    totalItems: number;
  };
  mustFix: {
    rules: any; // You can specify the type for rules if known
    totalItems: number;
  };
  needsReview: {
    rules: any; // You can specify the type for rules if known
    totalItems: number;
  };
  url: string = '';
  pageTitle: string = '';
  filePath: string = '';
  totalItems: number = 0;

  constructor() {
    this.goodToFix = {
      rules: {},
      totalItems: 0
    };
    this.mustFix = {
      rules: {},
      totalItems: 0
    };
    this.needsReview = {
      rules: {},
      totalItems: 0
    };
  }
}
class TransformedRuleObject {
  description: string;
  totalItems: number;
  conformance: string[];
  items: { message: string; page: string; context: any; }[];

  constructor() {
    this.description = '';
    this.totalItems = 0;
    this.conformance = [];
    this.items = [];
  }
}

// AAA: 1.4.8, 2.4.9
// AA: 1.3.4, 1.4.3, 1.4.4, 1.4.10
// A: 1.3.1, 4.1.1, 4.1.2
const LEVEL_AAA = ['2.4.9', '1.4.8'];
const LEVEL_AA = ['1.3.4', '1.4.3', '1.4.4', '1.4.10'];
const LEVEL_A = ['1.3.1', '4.1.1', '4.1.2'];
const clauseToLevel = {
  // mapping of clause to its A/AA/AAA level
  ...LEVEL_AA.reduce((prev, curr) => {
    prev[curr] = 'wcag2aa';
    return prev;
  }, {}),
  ...LEVEL_A.reduce((prev, curr) => {
    prev[curr] = 'wcag2a';
    return prev;
  }, {}),
};

const metaToCategoryMap = {
  critical: 'mustFix',
  error: 'goodToFix',
  serious: 'goodToFix',
  warning: 'goodToFix',
  ignore: 'goodToFix',
};

const EXCLUDED_RULES = {
  '1.3.4': { 1: true }, // test for page orientation deemed a false positive, so its excluded
};

const isRuleExcluded = rule => {
  const isExcluded = EXCLUDED_RULES[rule.clause]
    ? EXCLUDED_RULES[rule.clause][rule.testNumber]
    : false;
  return isExcluded || LEVEL_AAA.includes(rule.clause);
};

const getVeraExecutable = () => {
  let veraPdfExe;
  if (os.platform() === 'win32') {
    veraPdfExe = getExecutablePath('**/verapdf', 'verapdf.bat');
  } else {
    veraPdfExe = getExecutablePath('**/verapdf', 'verapdf');
  }
  if (!veraPdfExe) {
    let veraPdfExeNotFoundError =
      'Could not find veraPDF executable.  Please ensure veraPDF is installed at current directory.';
    consoleLogger.error(veraPdfExeNotFoundError);
    silentLogger.error(veraPdfExeNotFoundError);
  }
  return veraPdfExe;
};

// get validation profile
const getVeraProfile = () => {
  const veraPdfProfile = globSync('**/verapdf/**/WCAG-21.xml', {
    absolute: true,
    nodir: true,
  });

  if (veraPdfProfile.length === 0) {
    let veraPdfProfileNotFoundError =
      'Could not find veraPDF validation profile.  Please ensure veraPDF is installed at current directory.';
    consoleLogger.error(veraPdfProfileNotFoundError);
    silentLogger.error(veraPdfProfileNotFoundError);
    return undefined;
  }
  return veraPdfProfile[0];
};

const isPDF = buffer => {
  return (
    Buffer.isBuffer(buffer) && buffer.lastIndexOf('%PDF-') === 0 && buffer.lastIndexOf('%%EOF') > -1
  );
};

export const handlePdfDownload = (randomToken, pdfDownloads, request, sendRequest, urlsCrawled) => {
  const pdfFileName = randomUUID();
  const url:string = request.url
  const pageTitle = decodeURI(request.url).split('/').pop();

  pdfDownloads.push(
    new Promise<void>(async resolve => {
      let bufs = [];
      let pdfResponse;

      if (isFilePath(url)) {
        // Read the file from the file system
        const filePath = new URL(url).pathname;
        pdfResponse = fs.createReadStream(filePath, { encoding: 'binary' });
      } else {
        // Send HTTP/HTTPS request
        pdfResponse = await sendRequest({ responseType: 'buffer', isStream: true });
        pdfResponse.setEncoding('binary');
      }
      const downloadFile = fs.createWriteStream(`${randomToken}/${pdfFileName}.pdf`, {
        flags: 'a',
      });

      pdfResponse.on('data', chunk => {
        downloadFile.write(chunk, 'binary');
        bufs.push(Buffer.from(chunk));
      });

      pdfResponse.on('end', () => {
        downloadFile.end();
        const buf = Buffer.concat(bufs);
        if (isPDF(buf)) {
          guiInfoLog(guiInfoStatusTypes.SCANNED, {
            numScanned: urlsCrawled.scanned.length,
            urlScanned: request.url,
          });
          urlsCrawled.scanned.push({ url: url, pageTitle });
        } else {
          guiInfoLog(guiInfoStatusTypes.SKIPPED, {
            numScanned: urlsCrawled.scanned.length,
            urlScanned: request.url,
          });
          urlsCrawled.invalid.push(url);
        }
        resolve();
      });
    }),
  );

  return { pdfFileName, url };
};

export const runPdfScan = async randomToken => {
  const execFile = getVeraExecutable();
  const veraPdfExe = '"' + execFile + '"';
  // const veraPdfProfile = getVeraProfile();
  const veraPdfProfile =
    '"' +
    path.join(execFile, '..', 'profiles/veraPDF-validation-profiles-rel-1.24/PDF_UA/WCAG-21.xml') +
    '"';
  if (!veraPdfExe || !veraPdfProfile) {
    process.exit(1);
  }

  const intermediateFolder = randomToken; // NOTE: assumes this folder is already created for crawlee

  // store in a intermediate folder as we transfer final results later
  const intermediateResultPath = `${intermediateFolder}/${constants.pdfScanResultFileName}`;

  const veraPdfCmdArgs = [
    '-p',
    veraPdfProfile,
    '--format',
    'json',
    '-r', // recurse through directory
    intermediateFolder,
  ];

  const ls = spawnSync(veraPdfExe, veraPdfCmdArgs, { shell: true });
  fs.writeFileSync(intermediateResultPath, ls.stdout, { encoding: 'utf-8' });
};

// transform results from veraPDF to desired format for report
export const mapPdfScanResults = async (randomToken, uuidToUrlMapping) => {
  const intermediateFolder = randomToken;
  const intermediateResultPath = `${intermediateFolder}/${constants.pdfScanResultFileName}`;

  const rawdata = fs.readFileSync(intermediateResultPath, 'utf-8');

  let parsedJsonData;
  try {
    parsedJsonData = JSON.parse(rawdata);
  } catch (err) {
    consoleLogger.log(err);
  }

  const errorMeta = require('../constants/errorMeta.json');

  const resultsList = [];

  if (parsedJsonData) {
  // jobs: files that are scanned
  const {
    report: { jobs },
  } = parsedJsonData;

  // loop through all jobs
  for (let jobIdx = 0; jobIdx < jobs.length; jobIdx++) {
    const translated = new TranslatedObject();

    const { itemDetails, validationResult } = jobs[jobIdx];
    const { name: fileName } = itemDetails;

    const uuid = fileName
      .split(os.platform() === 'win32' ? '\\' : '/')
      .pop()
      .split('.')[0];
    const url = uuidToUrlMapping[uuid];
    const pageTitle = decodeURI(url).split('/').pop();
    const filePath = `${randomToken}/${uuid}.pdf`;

    translated.url = url;
    translated.pageTitle = pageTitle;
    translated.filePath = filePath;

    if (!validationResult) {
      // check for error in scan
      consoleLogger.info(`Unable to scan ${pageTitle}, skipping`);
      continue; // skip this job
    }

    // destructure validation result
    const { passedChecks, failedChecks, ruleSummaries } = validationResult.details;
    const totalChecks = passedChecks + failedChecks;

    translated.totalItems = totalChecks;

    // loop through all failed rules
    for (let ruleIdx = 0; ruleIdx < ruleSummaries.length; ruleIdx++) {
      const rule = ruleSummaries[ruleIdx];
      const { specification, testNumber, clause } = rule;

      if (isRuleExcluded(rule)) continue;
      const [ruleId, transformedRule] = await transformRule(rule, filePath);

      // ignore if violation is not in the meta file
      const meta = errorMeta[specification][clause][testNumber]?.STATUS ?? 'ignore';
      const category = translated[metaToCategoryMap[meta]];

      category.rules[ruleId] = transformedRule;
      category.totalItems += transformedRule.totalItems;
    }

    resultsList.push(translated);
  }
}
  return resultsList;
};

const transformRule = async (rule, filePath): Promise<[string, TransformedRuleObject]> => {
  // get specific rule
  const transformed = new TransformedRuleObject;
  const { specification, description, clause, testNumber, checks } = rule;

  transformed.description = description;
  transformed.totalItems = checks.length;

  if (specification === 'WCAG2.1') {
    transformed.conformance = [clauseToLevel[clause], 'wcag' + clause.split('.').join('')];
  } else {
    transformed.conformance = ['best-practice'];
  }

  transformed.items = [];

  for (let checkIdx = 0; checkIdx < checks.length; checkIdx++) {
    const { errorMessage, context } = checks[checkIdx];
    const page = await getPageFromContext(context, filePath);
    transformed.items.push({ message: errorMessage, page, context });
  }
  const ruleId = `pdf-${specification}-${clause}-${testNumber}`.replaceAll(' ', '_');

  return [ruleId, transformed];
};

// export const doPdfScreenshots = async (randomToken, result) => {
//   const { filePath, pageTitle } = result;
//   const formattedPageTitle = pageTitle.replaceAll(" ", "_").split('.')[0];
//   const screenshotsDir = path.join(randomToken, 'elemScreenshots', 'pdf');

//   ensureDirSync(screenshotsDir);

//   for (const category of ['mustFix', 'goodToFix']) {
//     const ruleItems = Object.entries(result[category].rules);
//     for (const [ruleId, ruleInfo] of ruleItems) {
//       const { items } = ruleInfo;
//       const filename = `${formattedPageTitle}-${category}-${ruleId}`;
//       const screenshotPath = path.join(screenshotsDir, filename);
//       const newItems = await getPdfScreenshots(filePath, items, screenshotPath);
//       ruleInfo.items = newItems;
//     }
//   }
// };
