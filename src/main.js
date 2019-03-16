/**
 * read config;
 * traverse folder;
 * convert;
 * save file;
 */
const config = require('./config.js');
const fs = require('fs');
const path = require('path');

const log = console.log.bind(console);

function readdirSyncRec(source) {
    let res = fs.readdirSync(source);
    let files = [];

    res.map(e => path.join(source, e)).forEach(e => {
        if (fs.statSync(e).isFile()) {
            files.push(e);
        } else {
            files = files.concat(readdirSyncRec(e));
        }
    });

    return files;
}

function validateConfig(config) {
    log(`config is: ${JSON.stringify(config)}`);

    // ensure source exists
    let source = config.source;

    if (!source) {
        log('No source specified!');
        return false;
    }

    if (!fs.existsSync(source)) {
        log(`source ${source} does NOT exist!`);
        return false;
    }

    // get sourceFiles list
    let sourceFiles = [];
    if (fs.statSync(source).isFile()) {
        sourceFiles.push(source);
    } else {
        sourceFiles = readdirSyncRec(source);
        log(`detected source files to be convert:`);
        log(sourceFiles);
    }

    if (sourceFiles.length === 0) {
        log(`no source file found for configured source ${source}!`);
        return false;
    }
    config.sourceFiles = sourceFiles;

    // get format
    let format = config.format;
    let validFormat = false;
    if (!format) {
        log('No format specified!');
    } else if (['old', 'new'].indexOf(format) < 0) {
        log(`Specified format ${format} is invalid!`);
    } else {
        validFormat = true;
    }

    if (!validFormat) {
        log(`Detect format from source files`);
        let format = parseFormatFromFiles(sourceFiles);
        if (!format) {
            log('failed to parse format');
            return;
        }

        config.format = format;
        log(`Use parsed format "${format}"`);
    }

    // ensure valid target directory specified
    let target = config.target;
    let validTarget = false;

    if (!target) {
        log(`No target specified`);
    } else if (fs.existsSync(target) && fs.statSync(target).isDirectory() && fs.readdirSync(target).length > 0) {
        log(`Specified target folder not empty!`);
    } else {
        validTarget = true;
    }

    if (!validTarget) {
        // find a default not used target directory
        let defaultTargetParent = path.join(__dirname, '..', 'output');
        let i = 1;

        while (fs.existsSync(path.join(defaultTargetParent, 'converted_' + i))) {
            i++;
        }

        config.target = path.join(defaultTargetParent, 'converted_' + i);

        log(`Use target ${config.target} instead`);
    }

    // ensure valid target directory exists and empty (checked)
    if (!fs.existsSync(config.target) || !fs.statSync(config.target).isDirectory()) {
        fs.mkdirSync(config.target, { recursive: true });
    }

    return true;
}

function parseFormat(file) {
    let data;
    try {
        data = JSON.parse(fs.readFileSync(file).toString());
    } catch (e) {
        log(`${file} is not json file`);
    }

    if (!data || !data.definition) {
        return;
    }

    let format;
    if (typeof data.definition === 'string') {
        format = 'old';
        log('parsed file is of old format');
    } else {
        format = 'new';
        log('parsed file is of new format');
    }

    return format;
}

function parseFormatFromFiles(files) {
    if ((files || []).length === 0) {
        return;
    }

    for (let file of files) {
        let format = parseFormat(file);
        if (format) {
            return format;
        }
    }
}

function convertFormat(srcFile, tgtDir, srcFormat) {
    let realFormat = parseFormat(srcFile);

    if (realFormat !== srcFormat) {
        log(`Real format "${realFormat}" does not match with specified source format "${srcFormat}"`);
        log(`Skip file ${srcFile}`);
        return;
    }

    let data = JSON.parse(fs.readFileSync(srcFile).toString());

    if (srcFormat === 'old') {
        data.definition = JSON.parse(data.definition);

        data.dataCollections.forEach(c => {
            c.data = JSON.parse(c.data);
        });
    } else if (srcFormat === 'new') {
        data.definition = JSON.stringify(data.definition);

        data.dataCollections.forEach(c => {
            c.data = JSON.stringify(c.data);
        });
    } else {
        log(`No valid srcFormat`);
        log(`Skip file ${srcFile}`);
        return;
    }

    // save file
    let tgtFileSubPath = getTgtFileSubPath(srcFile, config);

    let tgtFile = path.join(tgtDir, tgtFileSubPath);

    // ensure tgt file subpath exists
    let tgtFolder = tgtFile.split(path.sep);
    tgtFolder.pop();
    tgtFolder = tgtFolder.join(path.sep);

    if (!fs.existsSync(tgtFolder)) {
        fs.mkdirSync(tgtFolder, { recursive: true });
    }

    fs.writeFileSync(tgtFile, JSON.stringify(data));
    log(`Converted ${srcFile} with ${srcFormat} to ${tgtFile}`);
}

function getTgtFileSubPath(srcFile, config) {
    if (fs.statSync(config.source).isFile()) {
        // get file name
        return srcFile.split(path.sep)[srcFile.split(path.sep).length - 1];
    } else {
        // keep subfolder
        return srcFile.split(config.source)[1];
    }
}

function convertAll() {
    if (!validateConfig(config)) {
        return;
    }

    log(config.sourceFiles);

    for (let file of config.sourceFiles) {
        try {
            convertFormat(file, config.target, config.format);
        } catch (e) {
            log(e);
            log(`Failed to convert file ${file}`);
        }
    }

    log(`Finished all ${config.format} format files converting to tgtFolder ${config.target}`);
}

convertAll();