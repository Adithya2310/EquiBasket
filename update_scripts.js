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
        },
        'liquidity_pool.liquidity_pool.spend': {
            scriptKey: 'LiquidityPool',
            hashKey: 'LiquidityPoolUnapplied',
            rawScriptKey: 'rawLiquidityPoolScript' // Add this for raw script update
        },
        'lp_token_policy.lp_token_policy.mint': {
            scriptKey: 'LpTokenPolicy',
            hashKey: 'LpTokenPolicy'
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
                const scriptRegex = new RegExp(`(${config.scriptKey}:\\s*applyDoubleCborEncoding\\(\\s*")([a-fA-F0-9]*)(")`, 'g');

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
                const hashRegex = new RegExp(`(${config.hashKey}:\\s*")([a-fA-F0-9]*)(")`, 'g');

                if (hashRegex.test(scriptsTsContent)) {
                    scriptsTsContent = scriptsTsContent.replace(hashRegex, `$1${hash}$3`);
                    console.log(`  Updated Hash: ${config.hashKey}`);
                } else {
                    console.warn(`  Could not find Hash entry for ${config.hashKey}`);
                }
            }
        }
    });

    // Handle raw scripts for parameterized validators (Vault and LiquidityPool)
    const vaultValidator = validators.find(v => v.title === 'vault.vault.spend');
    if (vaultValidator) {
        const rawVaultScript = vaultValidator.compiledCode;
        const rawVaultScriptRegex = /(const\s+rawVaultScript\s*=\s*")([a-fA-F0-9]*)(")/;
        if (rawVaultScriptRegex.test(scriptsTsContent)) {
            scriptsTsContent = scriptsTsContent.replace(rawVaultScriptRegex, `$1${rawVaultScript}$3`);
            console.log('  Updated Raw Vault Script');
        } else {
            console.warn('  Could not find rawVaultScript entry');
        }
    }

    const liquidityPoolValidator = validators.find(v => v.title === 'liquidity_pool.liquidity_pool.spend');
    if (liquidityPoolValidator) {
        const rawLiquidityPoolScript = liquidityPoolValidator.compiledCode;
        const rawLiquidityPoolScriptRegex = /(const\s+rawLiquidityPoolScript\s*=\s*")([a-fA-F0-9]*)(")/;
        if (rawLiquidityPoolScriptRegex.test(scriptsTsContent)) {
            scriptsTsContent = scriptsTsContent.replace(rawLiquidityPoolScriptRegex, `$1${rawLiquidityPoolScript}$3`);
            console.log('  Updated Raw Liquidity Pool Script');
        } else {
            console.warn('  Could not find rawLiquidityPoolScript entry');
        }
    }

    fs.writeFileSync(scriptsTsPath, scriptsTsContent, 'utf8');
    console.log('Successfully updated scripts.ts');

} catch (error) {
    console.error('Error:', error);
}
