const fs = require('fs');
const path = require('path');

const plutusJsonPath = path.join(__dirname, 'plutus.json');
const scriptsTsPath = path.join(__dirname, 'offchain', 'config', 'scripts.ts');

try {
    const plutusJsonContent = fs.readFileSync(plutusJsonPath, 'utf8');
    const plutusJson = JSON.parse(plutusJsonContent);

    let scriptsTsContent = fs.readFileSync(scriptsTsPath, 'utf8');

    const validators = plutusJson.validators;

    const mapping = {
        'basket_factory.basket_factory.spend': {
            scriptKey: 'BasketFactory',
            hashKey: 'BasketFactory'
        },
        'mock_oracle.mock_oracle.spend': {
            scriptKey: 'MockOracle',
            hashKey: 'MockOracle'
        },
        'vault.vault.spend': {
            scriptKey: 'Vault',
            hashKey: 'VaultUnapplied'
        },
        'basket_token_policy.basket_token_policy_ref.mint': {
            scriptKey: 'BasketTokenPolicy',
            hashKey: 'BasketTokenPolicy'
        },
        'hello_word.hello_world.mint': {
            scriptKey: 'HelloWorld',
            hashKey: 'HelloWorld'
        }
    };

    validators.forEach(validator => {
        const title = validator.title;
        const config = mapping[title];

        if (config) {
            console.log(`Processing ${title}...`);

            // Update Scripts object
            if (config.scriptKey) {
                const compiledCode = validator.compiledCode;
                // Regex to find the key in Scripts object and replace the string inside applyDoubleCborEncoding
                // Matches: key: applyDoubleCborEncoding(\n    "OLD_CODE"
                const scriptRegex = new RegExp(`(${config.scriptKey}:\\s*applyDoubleCborEncoding\\(\\s*")([a-fA-F0-9]+)(")`, 'g');

                if (scriptRegex.test(scriptsTsContent)) {
                    scriptsTsContent = scriptsTsContent.replace(scriptRegex, `$1${compiledCode}$3`);
                    console.log(`  Updated Script: ${config.scriptKey}`);
                } else {
                    console.warn(`  Could not find Script entry for ${config.scriptKey}`);
                }
            }

            // Update ScriptHashes object
            if (config.hashKey) {
                const hash = validator.hash;
                // Regex to find the key in ScriptHashes object
                // Matches: key: "OLD_HASH",
                const hashRegex = new RegExp(`(${config.hashKey}:\\s*")([a-fA-F0-9]+)(")`, 'g');

                if (hashRegex.test(scriptsTsContent)) {
                    scriptsTsContent = scriptsTsContent.replace(hashRegex, `$1${hash}$3`);
                    console.log(`  Updated Hash: ${config.hashKey}`);
                } else {
                    console.warn(`  Could not find Hash entry for ${config.hashKey}`);
                }
            }
        }
    });

    fs.writeFileSync(scriptsTsPath, scriptsTsContent, 'utf8');
    console.log('Successfully updated scripts.ts');

} catch (error) {
    console.error('Error:', error);
}
