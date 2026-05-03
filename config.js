require('dotenv').config({ path: __dirname + '/.env' });

module.exports = {
    api_token: process.env.API_TOKEN,
    db_host: process.env.DB_HOST,
    db_user: process.env.DB_USER,
    db_pass: process.env.DB_PASS,
    db_name: process.env.DB_NAME,
    furniture_data_path: process.env.FURNITURE_DATA_PATH,
    nitro_bundled_path: process.env.NITRO_BUNDLED_PATH,
    converter_cwd: process.env.CONVERTER_CWD,
    converter_swf_path: process.env.CONVERTER_SWF_PATH,
    converter_bundled_path: process.env.CONVERTER_BUNDLED_PATH,
    cms_icons_path: process.env.CMS_ICONS_PATH,
    dcr_icons_path: process.env.DCR_ICONS_PATH,
    cms_path: process.env.CMS_PATH,
    emulator_repo_url: process.env.EMULATOR_REPO_URL,
    emulator_source_path: process.env.EMULATOR_SOURCE_PATH,
    emulator_live_path: process.env.EMULATOR_LIVE_PATH,
    emulator_jar_name: process.env.EMULATOR_JAR_NAME,
    emulator_min_ram: process.env.EMULATOR_MIN_RAM,
    emulator_max_ram: process.env.EMULATOR_MAX_RAM
};
