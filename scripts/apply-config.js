const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

// Load master config
const clientConfig = require('../client.config.json');
const appData = clientConfig.app_data;
const authorData = clientConfig.author_data;
const customisation = clientConfig.app_customisation;

// === Validate config ===
const required = {
  app_data: ['appname', 'packageid', 'versionname', 'versioncode', 'ios_CFBundleVersion', 'app_description'],
  author_data: ['app_author_name', 'app_author_email', 'author_website'],
  app_customisation: ['header_backgorud_colour', 'header_text_colour', 'brandColor'],
};
const errors = [];
for (const [section, keys] of Object.entries(required)) {
  for (const key of keys) {
    if (!clientConfig[section] || !clientConfig[section][key]) {
      errors.push(`Missing ${section}.${key}`);
    }
  }
}
if (appData && appData.packageid && !/^[a-zA-Z][\w]*(\.[a-zA-Z][\w]*)+$/.test(appData.packageid)) {
  errors.push(`Invalid app_data.packageid: ${appData.packageid}`);
}
for (const key of ['header_backgorud_colour', 'header_text_colour', 'brandColor']) {
  const value = customisation && customisation[key];
  if (value && !/^#[0-9a-fA-F]{3,8}$/.test(value)) {
    errors.push(`Invalid colour app_customisation.${key}: ${value}`);
  }
}
if (errors.length) {
  console.error('❌ client.config.json is invalid:\n  - ' + errors.join('\n  - '));
  process.exit(1);
}

// Escape a value used as a replacement string (avoid "$&" etc. being interpreted) and XML special chars.
const xmlEscape = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

// Replace a single attribute inside a tag string, failing loudly if it isn't there.
function setAttribute(tag, attr, value) {
  const regex = new RegExp(`(\\s${attr}=")[^"]*(")`);
  if (!regex.test(tag)) {
    throw new Error(`Attribute "${attr}" not found in config.xml`);
  }
  return tag.replace(regex, (_, start, end) => start + xmlEscape(value) + end);
}

// Replace the first match of a regex in the text, failing loudly if there is none.
function replaceOnce(text, regex, replacement, what) {
  if (!regex.test(text)) {
    throw new Error(`${what} not found in config.xml`);
  }
  return text.replace(regex, () => replacement);
}

// === Update config.xml ===
const configXmlPath = path.join(root, 'config.xml');
let configXml = fs.readFileSync(configXmlPath, 'utf8');

// Only touch the root <widget> tag attributes.
configXml = replaceOnce(configXml, /<widget\b[^>]*>/, (() => {
  let widget = configXml.match(/<widget\b[^>]*>/)[0];
  widget = setAttribute(widget, 'id', appData.packageid);
  widget = setAttribute(widget, 'version', appData.versionname);
  widget = setAttribute(widget, 'android-versionCode', appData.versioncode);
  widget = setAttribute(widget, 'versionCode', appData.versioncode);
  widget = setAttribute(widget, 'ios-CFBundleVersion', appData.ios_CFBundleVersion);
  return widget;
})(), '<widget> tag');

configXml = replaceOnce(configXml, /<name>[^<]*<\/name>/, `<name>${xmlEscape(appData.appname)}</name>`, '<name>');
configXml = replaceOnce(
  configXml,
  /<description>[^<]*<\/description>/,
  `<description>${xmlEscape(appData.app_description)}</description>`,
  '<description>',
);
configXml = replaceOnce(
  configXml,
  /<author\b[^>]*>[^<]*<\/author>/,
  `<author email="${xmlEscape(authorData.app_author_email)}" href="${xmlEscape(authorData.author_website)}">` +
    `${xmlEscape(authorData.app_author_name)}</author>`,
  '<author>',
);
configXml = replaceOnce(
  configXml,
  /<preference name="AppendUserAgent" value="[^"]*" \/>/,
  `<preference name="AppendUserAgent" value="MoodleMobile ${xmlEscape(appData.versionname)} (${xmlEscape(appData.versioncode)})" />`,
  'AppendUserAgent preference',
);

fs.writeFileSync(configXmlPath, configXml);
console.log(`✅ Updated config.xml: ${appData.appname} (${appData.packageid}) ${appData.versionname}`);

// === Update client-variables.scss ===
const themeFile = path.join(root, 'src/theme/client-variables.scss');
const themeContent = `
$brand-color: ${customisation.brandColor};
:root {
  --core-header-toolbar-background: ${customisation.header_backgorud_colour};
  --core-header-toolbar-color: ${customisation.header_text_colour};
}
`;

fs.writeFileSync(themeFile, themeContent, 'utf8');
console.log(`✅ Updated header color in client-variables.scss: ${customisation.header_backgorud_colour}`);

// === Update moodle.config.json ===
const configPath = path.join(root, 'moodle.config.json');
const moodleConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

moodleConfig.app_id = appData.packageid;
moodleConfig.appname = appData.appname;
moodleConfig.versioncode = Number(appData.versioncode);
moodleConfig.versionname = appData.versionname;

if (appData.privacypolicy) {
  moodleConfig.privacypolicy = appData.privacypolicy;
}
if (appData.notificoncolor) {
  moodleConfig.notificoncolor = appData.notificoncolor;
}
if (appData.moodle_site_url) {
  moodleConfig.sites = [appData.moodle_site_url];
}

fs.writeFileSync(configPath, JSON.stringify(moodleConfig, null, 4) + '\n', 'utf8');
console.log('✅ moodle.config.json updated successfully!');

// === Update google-services.json ===
const googleConfigPath = path.join(root, 'google-services.json');
const googleConfig = JSON.parse(fs.readFileSync(googleConfigPath, 'utf8'));

for (const client of googleConfig.client || []) {
  client.client_info.android_client_info.package_name = appData.packageid;
}

fs.writeFileSync(googleConfigPath, JSON.stringify(googleConfig, null, 2) + '\n', 'utf8');
console.log('✅ Updated google-services.json');

if (appData.moodle_site_url && appData.moodle_site_url.logo) {
  const logoPath = path.join(root, 'src', appData.moodle_site_url.logo);
  if (!fs.existsSync(logoPath)) {
    console.warn(`⚠️  Site logo not found: ${path.relative(root, logoPath)}`);
  }
}

console.warn('⚠️  GoogleService-Info.plist (iOS) is not updated by this script.');
