const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');

// Load master config
const clientConfig = require('../client.config.json');
const clientConfigAppdata = clientConfig.app_data;
const clientConfigAuthorData = clientConfig.author_data;
const clientConfigAppCustomisation = clientConfig.app_customisation;

// === Update config.xml ===
const configXmlPath = path.join(__dirname, '../config.xml');
let configXml = fs.readFileSync(configXmlPath, 'utf8');
configXml = configXml
  .replace(/<name>.*<\/name>/, `<name>${clientConfigAppdata.appname}</name>`)
  .replace(/id="[^"]+"/, `id="${clientConfigAppdata.packageid}"`)
  .replace(/android-versionCode="[^"]+"/, `android-versionCode="${clientConfigAppdata.versioncode}"`)
  .replace(/version="[^"]+"/, `version="${clientConfigAppdata.versionname}"`)
  .replace(/ios-CFBundleVersion="[^"]+"/, `ios-CFBundleVersion="${clientConfigAppdata.ios_CFBundleVersion}"`)
  .replace(/ versionCode="[^"]+"/, ` versionCode="${clientConfigAppdata.versioncode}"`)
  .replace(/<description>.*<\/description>/, `<description>${clientConfigAppdata.app_description}</description>`)
  .replace(/<author[^>]*email="[^"]+"[^>]*href="[^"]+"[^>]*>.*<\/author>/, `<author email="${clientConfigAuthorData.app_author_email}" href="${clientConfigAuthorData.author_website}">${clientConfigAuthorData.app_author_name}</author>`);

fs.writeFileSync(configXmlPath, configXml);
console.log("✅ Applied client config:", clientConfig.appname);


const themeFile = path.join(__dirname, '../src/theme/client-variables.scss');
const themeContent = `
$brand-color: ${clientConfigAppCustomisation.brandColor};
:root {
  --core-header-toolbar-background: ${clientConfigAppCustomisation.header_backgorud_colour};
  --core-header-toolbar-color: ${clientConfigAppCustomisation.header_text_colour};
}
`;

fs.writeFileSync(themeFile, themeContent, 'utf8');
console.log(`✅ Updated header color in client-variables.scss: ${clientConfigAppCustomisation.header_backgorud_colour}`);

// === Update moodle.config.json ===
// Path to moodle.config.json
const configPath = path.join(__dirname, '../moodle.config.json');

// Load the config file
let moodleConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Update values from clientConfig
moodleConfig.app_id = clientConfigAppdata.packageid || moodleConfig.app_id;
moodleConfig.appname = clientConfigAppdata.appname || moodleConfig.appname;
moodleConfig.versioncode = clientConfigAppdata.versioncode || moodleConfig.versioncode;
moodleConfig.versionname = clientConfigAppdata.versionname || moodleConfig.versionname;

// Example: custom logo / privacy policy / colors etc.
if (clientConfigAppdata.privacypolicy) {
  moodleConfig.privacypolicy = clientConfigAppdata.privacypolicy;
}
if (clientConfigAppdata.notificoncolor) {
  moodleConfig.notificoncolor = clientConfigAppdata.notificoncolor;
}
if (clientConfigAppdata.moodle_site_url) {
  moodleConfig.sites = [clientConfigAppdata.moodle_site_url];
}

// Save back to file
fs.writeFileSync(configPath, JSON.stringify(moodleConfig, null, 4), 'utf8');

console.log('✅ moodle.config.json updated successfully!');


let googleconfigPath = path.join(__dirname, "..", "google-services.json");

// Load existing google-services.json
const googleConfig = JSON.parse(fs.readFileSync(googleconfigPath, "utf8"));

// Update package name
googleConfig.client[0].client_info.android_client_info.package_name = clientConfigAppdata.packageid;

// Save it back
fs.writeFileSync(googleconfigPath, JSON.stringify(googleConfig, null, 2), "utf8");

console.log("✅ Updated google-services.json ");
