const inquirer = require('inquirer');
const chalk = require('chalk');
const boxen = require('boxen');
const figlet = require('figlet');
const gradient = require('gradient-string');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

if (!fs.existsSync(path.join(__dirname, '../.env'))) {
    console.log(chalk.red('⚠️  No se encontró el archivo .env. Por favor, ejecuta ./run.sh o core/setup.js para iniciar el setup.'));
    process.exit(1);
}

const config = require('../config.js');

function checkServerStatus() {
    try {
        const out = spawnSync('ps', ['aux'], { encoding: 'utf8' }).stdout || '';
        const isRunning = out.includes(config.emulator_jar_name);
        const autoStart = fs.existsSync(path.join(__dirname, '../.emulator_auto_restart'));
        return { isRunning, autoStart };
    } catch(e) { return { isRunning: false, autoStart: false }; }
}

async function showHeader() {
    console.clear();
    console.log(gradient.pastel.multiline(figlet.textSync('KekoSuite', { horizontalLayout: 'fitted' })));
    console.log(chalk.gray('  v1.0.5 — Premium Edition by eMiLiOp \n'));

    const { isRunning, autoStart } = checkServerStatus();
    
    const statusText = `
${chalk.bold('Estado:')} ${isRunning ? chalk.green('● ENCENDIDO') : chalk.red('○ APAGADO')}
${chalk.bold('Auto-Start:')} ${autoStart ? chalk.green('Activo') : chalk.gray('Inactivo')}
${chalk.bold('RAM:')} ${chalk.cyan(config.emulator_min_ram)} - ${chalk.cyan(config.emulator_max_ram)}
    `.trim();

    console.log(boxen(statusText, {
        padding: 1,
        margin: { bottom: 1 },
        borderStyle: 'round',
        borderColor: isRunning ? 'green' : 'red',
        title: ' Control del Servidor ',
        titleAlignment: 'center'
    }));
}

async function mainMenu() {
    await showHeader();

    const { option } = await inquirer.prompt([
        {
            type: 'list',
            name: 'option',
            message: 'Selecciona una categoría:',
            choices: [
                { name: '🛋️  Gestión de Furnis y Ropa', value: 'furnis' },
                { name: '🛠️  Mantenimiento y Optimización', value: 'maint' },
                { name: '🔄 Gestión de Actualizaciones', value: 'update' },
                { name: '⚙️  Control del Servidor', value: 'server' },
                new inquirer.Separator(),
                { name: '❌ Salir', value: 'exit' }
            ],
            pageSize: 10
        }
    ]);

    switch (option) {
        case 'furnis': return await furnisMenu();
        case 'maint': return await maintMenu();
        case 'update': return await updateMenu();
        case 'server': return await serverMenu();
        case 'exit': 
            console.clear(); 
            console.log(chalk.cyan('¡Hasta pronto!\n')); 
            process.exit(0);
    }
}

async function runScript(scriptPath) {
    spawnSync('node', [path.join(__dirname, '..', scriptPath)], { stdio: 'inherit' });
    await inquirer.prompt([{ type: 'input', name: 'pressEnter', message: chalk.gray('Presiona Enter para volver...') }]);
    await mainMenu();
}

async function furnisMenu() {
    await showHeader();
    const { option } = await inquirer.prompt([
        {
            type: 'list',
            name: 'option',
            message: '🛋️  Gestión de Furnis y Ropa:',
            choices: [
                { name: '📦 Sincronizador Maestro (API)', value: 'core/mass_syncer.js' },
                { name: '👕 Sincronizador de Ropa', value: 'core/auto_clothing_importer.js' },
                { name: '📥 Importador Manual', value: 'core/index.js' },
                { name: '🔧 Reparador de Furnis Rotos', value: 'core/furni_fixer.js' },
                { name: '🔤 Traductor de Nombres (Auto)', value: 'core/name_updater.js' },
                { name: '🎁 Generar Ofertas Especiales (Targets)', value: 'core/offers_generator.js' },
                new inquirer.Separator(),
                { name: '⬅️  Volver', value: 'back' }
            ],
            pageSize: 12
        }
    ]);
    if (option === 'back') await mainMenu();
    else await runScript(option);
}

async function maintMenu() {
    await showHeader();
    const { option } = await inquirer.prompt([
        {
            type: 'list',
            name: 'option',
            message: '🛠️  Mantenimiento y Optimización:',
            choices: [
                { name: '⬛ Escanear Cuadrados Negros (Icons)', value: 'core/broken_furni_scanner.js' },
                { name: '🗂️  Encontrar Muebles Duplicados', value: 'core/duplicate_finder.js' },
                { name: '🧹 Limpiar Items_base Huérfanos', value: 'core/orphan_cleaner.js' },
                { name: '💰 Editor Masivo de Precios', value: 'core/mass_price_updater.js' },
                { name: '🗑️  Limpiar Catálogo (Huérfanos/Páginas rotas)', value: 'core/catalog_cleaner.js' },
                { name: '🖼️  Descargar Iconos Faltantes (PNGs)', value: 'core/icon_fetcher.js' },
                new inquirer.Separator(),
                { name: '⬅️  Volver', value: 'back' }
            ],
            pageSize: 12
        }
    ]);
    if (option === 'back') await mainMenu();
    else await runScript(option);
}

async function updateMenu() {
    await showHeader();
    const { option } = await inquirer.prompt([
        {
            type: 'list',
            name: 'option',
            message: '🔄 Gestión de Actualizaciones:',
            choices: [
                { name: '🌐 Comprobar Novedades de HabboFurni', value: 'core/update_checker.js' },
                { name: '🖥️  Actualizar CMS', value: 'core/cms_updater.js' },
                { name: '🚀 Actualizar Emulador Arcturus', value: 'core/emulator_updater.js' },
                new inquirer.Separator(),
                { name: '⬅️  Volver', value: 'back' }
            ],
            pageSize: 10
        }
    ]);
    if (option === 'back') await mainMenu();
    else await runScript(option);
}

async function serverMenu() {
    await showHeader();
    const { isRunning } = checkServerStatus();
    
    let choices = [];
    if (!isRunning) {
        choices = [
            { name: '▶ Encender Servidor (Con Auto-Start)', value: 'start_auto' },
            { name: '▷ Encender Servidor (Sin Auto-Start)', value: 'start_manual' },
            { name: '🔄 Cambiar Versión de Emulador', value: 'change_version' },
            { name: '🧠 Configurar Asignación de RAM', value: 'config_ram' },
        ];
    } else {
        choices = [
            { name: '⏹ Apagar Servidor', value: 'stop' },
            { name: '🔃 Reiniciar Servidor', value: 'restart' },
            { name: '♾️  Alternar Auto-Reinicio (Cron)', value: 'toggle_auto' },
            { name: '📺 Ver Consola en Vivo (Screen)', value: 'view_console' },
            { name: '🔄 Cambiar Versión de Emulador', value: 'change_version' },
            { name: '🧠 Configurar Asignación de RAM', value: 'config_ram' },
        ];
    }

    choices.push(new inquirer.Separator());
    choices.push({ name: '⬅️  Volver', value: 'back' });

    const { option } = await inquirer.prompt([
        { type: 'list', name: 'option', message: '⚙️  Control del Servidor:', choices, pageSize: 12 }
    ]);

    const livePath = config.emulator_live_path;
    const jarName = config.emulator_jar_name;
    const minRam = config.emulator_min_ram;
    const maxRam = config.emulator_max_ram;
    const autoRestartPath = path.join(__dirname, '../.emulator_auto_restart');

    switch (option) {
        case 'start_auto':
            fs.writeFileSync(autoRestartPath, '');
            spawnSync('bash', ['-c', `cd ${livePath} && screen -dmS emulator java -Dfile.encoding=UTF8 -Xms${minRam} -Xmx${maxRam} -jar ${jarName}`]);
            console.log(chalk.green('\n✔ Servidor iniciando en segundo plano con Auto-Start.'));
            break;
        case 'start_manual':
            if (fs.existsSync(autoRestartPath)) fs.unlinkSync(autoRestartPath);
            spawnSync('bash', ['-c', `cd ${livePath} && screen -dmS emulator java -Dfile.encoding=UTF8 -Xms${minRam} -Xmx${maxRam} -jar ${jarName}`]);
            console.log(chalk.green('\n✔ Servidor iniciando en segundo plano.'));
            break;
        case 'stop':
            if (fs.existsSync(autoRestartPath)) fs.unlinkSync(autoRestartPath);
            spawnSync('pkill', ['-f', jarName]);
            spawnSync('screen', ['-S', 'emulator', '-X', 'quit']);
            console.log(chalk.red('\n✔ Servidor apagado.'));
            break;
        case 'restart':
            spawnSync('pkill', ['-f', jarName]);
            spawnSync('screen', ['-S', 'emulator', '-X', 'quit']);
            spawnSync('bash', ['-c', `cd ${livePath} && screen -dmS emulator java -Dfile.encoding=UTF8 -Xms${minRam} -Xmx${maxRam} -jar ${jarName}`]);
            console.log(chalk.yellow('\n✔ Servidor reiniciado.'));
            break;
        case 'toggle_auto':
            if (fs.existsSync(autoRestartPath)) {
                fs.unlinkSync(autoRestartPath);
                console.log(chalk.gray('\nAuto-reinicio desactivado.'));
            } else {
                fs.writeFileSync(autoRestartPath, '');
                console.log(chalk.green('\nAuto-reinicio activado.'));
            }
            break;
        case 'view_console':
            console.log(chalk.cyan('\nUsa CTRL+A y luego D para salir de la consola sin apagar el servidor.'));
            spawnSync('screen', ['-r', 'emulator'], { stdio: 'inherit' });
            return await serverMenu();
        case 'change_version':
            const files = fs.readdirSync(livePath).filter(f => f.endsWith('.jar'));
            if (files.length === 0) {
                console.log(chalk.red('\nNo se encontraron archivos .jar en ' + livePath));
            } else {
                const { selected } = await inquirer.prompt([{ type: 'list', name: 'selected', message: 'Selecciona versión:', choices: files }]);
                let envPath = path.join(__dirname, '../.env');
                let envData = fs.readFileSync(envPath, 'utf8');
                envData = envData.replace(/^EMULATOR_JAR_NAME=.*$/m, 'EMULATOR_JAR_NAME="' + selected + '"');
                fs.writeFileSync(envPath, envData);
                config.emulator_jar_name = selected; // update runtime
                console.log(chalk.green('\n✔ Versión actualizada a ' + selected));
            }
            break;
        case 'config_ram':
            const { minRamNew, maxRamNew } = await inquirer.prompt([
                { type: 'input', name: 'minRamNew', message: 'RAM Mínima (ej: 1G) [Dejar vacío para no cambiar]:' },
                { type: 'input', name: 'maxRamNew', message: 'RAM Máxima (ej: 2G) [Dejar vacío para no cambiar]:' }
            ]);
            let envPath = path.join(__dirname, '../.env');
            let envData = fs.readFileSync(envPath, 'utf8');
            if (minRamNew) {
                envData = envData.replace(/^EMULATOR_MIN_RAM=.*$/m, 'EMULATOR_MIN_RAM="' + minRamNew + '"');
                config.emulator_min_ram = minRamNew;
            }
            if (maxRamNew) {
                envData = envData.replace(/^EMULATOR_MAX_RAM=.*$/m, 'EMULATOR_MAX_RAM="' + maxRamNew + '"');
                config.emulator_max_ram = maxRamNew;
            }
            fs.writeFileSync(envPath, envData);
            console.log(chalk.green('\n✔ Configuración de RAM actualizada.'));
            break;
        case 'back':
            return await mainMenu();
    }
    
    await inquirer.prompt([{ type: 'input', name: 'pressEnter', message: chalk.gray('Presiona Enter para volver...') }]);
    await serverMenu();
}

mainMenu().catch(console.error);
