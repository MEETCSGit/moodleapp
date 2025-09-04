const fs = require('fs');
const path = require('path');

// Load master config
const clientConfig = require('../client.config.json');

// === Update config.xml ===
const configXmlPath = path.join(__dirname, '../config.xml');
let configXml = fs.readFileSync(configXmlPath, 'utf8');
configXml = configXml
  .replace(/<name>.*<\/name>/, `<name>${clientConfig.appname}</name>`)
  .replace(/id="[^"]+"/, `id="${clientConfig.packageid}"`)
  .replace(/android-versionCode="[^"]+"/, `android-versionCode="${clientConfig.versioncode}"`)
  .replace(/version="[^"]+"/, `version="${clientConfig.versionname}"`)
  .replace(/ios-CFBundleVersion="[^"]+"/, `ios-CFBundleVersion="${clientConfig.ios_CFBundleVersion}"`)
  .replace(/ versionCode="[^"]+"/, ` versionCode="${clientConfig.versioncode}"`)
  .replace(/<description>.*<\/description>/, `<description>${clientConfig.app_description}</description>`)
  .replace(/<author[^>]*email="[^"]+"[^>]*href="[^"]+"[^>]*>.*<\/author>/,`<author email="${clientConfig.app_author_email}" href="${clientConfig.author_website}">${clientConfig.app_author_name}</author>`);

fs.writeFileSync(configXmlPath, configXml);

// === Update moodle.config.json ===
// const moodleConfigPath = path.join(__dirname, '../src/assets/moodle.config.json');
// let moodleConfig = JSON.parse(fs.readFileSync(moodleConfigPath, 'utf8'));

// moodleConfig.app_id = clientConfig.packageid;
// moodleConfig.versionname = clientConfig.versionname;
// moodleConfig.versioncode = clientConfig.versioncode;
// moodleConfig.appname = clientConfig.appname;

// fs.writeFileSync(moodleConfigPath, JSON.stringify(moodleConfig, null, 2));

console.log("✅ Applied client config:", clientConfig.appname);
