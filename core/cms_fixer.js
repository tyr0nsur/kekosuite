const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const readline = require('readline');
const config = require('../config.js');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
const question = (query) => new Promise(resolve => rl.question(query, resolve));

const CMS_PATH = config.cms_path;

async function main() {
    console.log("==============================================");
    console.log("   Habbo Tools Suite: Reparador de CMS       ");
    console.log("==============================================\n");

    try {
        console.log("[1/5] Restaurando código oficial (Hard Reset)...");
        execSync('git fetch --all', { cwd: CMS_PATH, stdio: 'inherit' });
        execSync('git reset --hard origin/main', { cwd: CMS_PATH, stdio: 'inherit' });
        
        console.log("Limpiando bloqueos y aplicando parche...");
        const composerPath = path.join(CMS_PATH, 'composer.json');
        const lockPath = path.join(CMS_PATH, 'composer.lock');
        
        if (fs.existsSync(lockPath)) {
            fs.unlinkSync(lockPath);
        }

        let composerJson = fs.readFileSync(composerPath, 'utf8');
        const repoRegex = /\{\s+"name":\s+"filament",\s+"type":\s+"composer",\s+"url":\s+"https:\/\/packages\.filamentphp\.com\/composer"\s+\},\s+/g;
        composerJson = composerJson.replace(repoRegex, '');
        composerJson = composerJson.replace(/"filament\/blueprint":\s+"[^"]+",\s+/, '');
        composerJson = composerJson.replace(/"filament\/upgrade":\s+"[^"]+",\s+/, '');
        fs.writeFileSync(composerPath, composerJson);

        console.log("\n[2/5] Instalando dependencias PHP (Composer)...");
        execSync('composer install --no-interaction --prefer-dist --ignore-platform-reqs --no-dev', { cwd: CMS_PATH, stdio: 'inherit' });

        console.log("\n[3/5] Instalando y construyendo activos (NPM)...");
        console.log("Esto es necesario para el diseño de la web.");
        execSync('npm install', { cwd: CMS_PATH, stdio: 'inherit' });
        execSync('npm run build:atom', { cwd: CMS_PATH, stdio: 'inherit' });

        console.log("\n[4/5] Actualizando base de datos...");
        execSync('php artisan migrate --force', { cwd: CMS_PATH, stdio: 'inherit' });
        execSync('php artisan db:seed --class=WebsiteWordfilterSeeder --force', { cwd: CMS_PATH, stdio: 'inherit' });

        console.log("\n[5/5] Finalizando y configurando permisos...");
        execSync('php artisan filament:upgrade', { cwd: CMS_PATH, stdio: 'inherit' });
        execSync('chmod -R 775 storage bootstrap/cache', { cwd: CMS_PATH, stdio: 'inherit' });

        console.log("\n✅ CMS reparado, compilado y actualizado exitosamente.");
    } catch (err) {
        console.error("\n❌ Error durante la reparación:");
        console.error(err.message);
    }

    rl.close();
}

main();
