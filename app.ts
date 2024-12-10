import { retrieveEnv, logger } from './lib';
import { Connection } from './lib/backpack';
import { TgBot } from './lib/telegbot/telegbot';

const BACKPACK_API_KEY = retrieveEnv('BACKPACK_API_KEY');
const BACKPACK_API_SECRET = retrieveEnv('BACKPACK_API_SECRET');

const TG_BOT_API_TOKEN = retrieveEnv('TELEGRAM_BOT_API_TOKEN');
const TG_TARGET_CHAT_ID = retrieveEnv('TELEGRAM_TARGET_CHAT_ID');
const TG_NOTIFY_INTERVAL = 3600000;

const SYMBOL = retrieveEnv('SYMBOL');
const LOWER_PRICE = parseFloat(retrieveEnv('LOWER_PRICE'));
const UPPER_PRICE = parseFloat(retrieveEnv('UPPER_PRICE'));
const PRICE_DECIMAL = parseFloat(retrieveEnv('PRICE_DECIMAL'));
const NUMBER_OF_GRIDS = parseInt(retrieveEnv('NUMBER_OF_GRIDS'));
const QUANTITY_PER_GRID = parseFloat(retrieveEnv('QUANTITY_PER_GRID'));


const connection = new Connection(BACKPACK_API_KEY, BACKPACK_API_SECRET);

const bot_notify = () => {
    if(TG_BOT_API_TOKEN == ''){
        return;
    }
    const bot = new TgBot(TG_BOT_API_TOKEN, TG_TARGET_CHAT_ID);
    setInterval(async () => {
        try {
            const { lastPrice: lastPrice } = await connection.apiCall("ticker", { symbol: SYMBOL });
            const orders = await connection.apiCall("orderQueryAll", { symbol: SYMBOL });

            let bid = orders.filter((order: any) => order['side']== 'Bid').length;
            let ask = orders.length - bid;
            
            bot.notify(`
<b>[${SYMBOL}] ${lastPrice}</b>
Bid: ${bid} | Ask: ${ask}
            `, { parse_mode: "html" });
        } catch (error) {
            logger.error(`[${SYMBOL}] Notify user failed: ${error}`);
        }
    }, TG_NOTIFY_INTERVAL);
}

const checkBalance = async (side: string, quantity: number, price: number) => {
    try {
        const balances = await connection.apiCall("balanceQuery");
        const requiredAsset = side === 'Bid' ? 'USDC' : 'SOL';
        
        // 确保 balances 是一个对象
        if (typeof balances !== 'object' || balances === null) {
            logger.error(`[${SYMBOL}] Invalid balance response format`);
            return false;
        }

        // 直接访问对象属性
        const balance = balances[requiredAsset];
        if (!balance) {
            logger.error(`[${SYMBOL}] Cannot find ${requiredAsset} balance`);
            return false;
        }

        const available = parseFloat(balance.available);
        const required = side === 'Bid' ? quantity * price : quantity;

        if (available < required) {
            logger.error(`[${SYMBOL}] Insufficient ${requiredAsset} balance. Required: ${required}, Available: ${available}`);
            return false;
        }

        return true;
    } catch (error) {
        logger.error(`[${SYMBOL}] Failed to check balance: ${error}`);
        return false;
    }
};

const calculateInitialCost = async () => {
    try {
        const { lastPrice } = await connection.apiCall("ticker", { symbol: SYMBOL });
        let totalSOL = 0;
        let totalUSDC = 0;

        let orders = [];
        for (let i = 0; i < NUMBER_OF_GRIDS; i++) {
            let price = LOWER_PRICE + i * ((UPPER_PRICE - LOWER_PRICE) / NUMBER_OF_GRIDS);
            orders.push(price);

            if (price < lastPrice) {
                totalUSDC += price * QUANTITY_PER_GRID;
            } else {
                totalSOL += QUANTITY_PER_GRID;
            }
        }

        logger.info(`[${SYMBOL}] Estimated required balance: ${totalSOL.toFixed(4)} SOL and ${totalUSDC.toFixed(2)} USDC`);
        return { totalSOL, totalUSDC };
    } catch (error) {
        logger.error(`[${SYMBOL}] Failed to calculate initial cost: ${error}`);
        return null;
    }
};

async function waitForSufficientBalance(side: string, price: number, quantity: number): Promise<void> {
    while (true) {
        const hasBalance = await checkBalance(side, quantity, price);
        if (hasBalance) {
            console.log(`Sufficient balance found for ${side} order`);
            return;
        }
        console.log(`Insufficient balance for ${side} order, waiting for 5 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
    }
}

const run = async () => {
    const gridStep = (UPPER_PRICE - LOWER_PRICE) / NUMBER_OF_GRIDS;

    let orders: number[] = [];
    for (let i = 0; i < NUMBER_OF_GRIDS; i++) {
        let price = LOWER_PRICE + i * gridStep;
        orders.push(price);
    }

    // Calculate required balance
    const requiredBalance = await calculateInitialCost();
    if (!requiredBalance) {
        logger.error(`[${SYMBOL}] Failed to calculate required balance. Exiting...`);
        process.exit(1);
    }

    // Wait for sufficient balance
    logger.info(`[${SYMBOL}] Checking for sufficient balance...`);
    await waitForSufficientBalance('Bid', requiredBalance.totalUSDC / QUANTITY_PER_GRID, QUANTITY_PER_GRID);
    await waitForSufficientBalance('Ask', 0, requiredBalance.totalSOL);

    // Cancel all existing orders for the symbol
    const _ = await connection.apiCall("orderCancelAll", { symbol: SYMBOL });
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Get current market price
    const { lastPrice } = await connection.apiCall("ticker", { symbol: SYMBOL });

    const orderExecute = async (clientId: number, price: number, side: string, notice: boolean = false) => {
        try {
            // Check balance before placing order
            const hasEnoughBalance = await checkBalance(side, QUANTITY_PER_GRID, price);
            if (!hasEnoughBalance) {
                logger.warn(`[${SYMBOL}] Skipping order due to insufficient balance. Will retry in next update.`);
                return false;
            }

            await connection.apiCall("orderExecute", {
                clientId,
                orderType: "Limit",
                price: price.toFixed(PRICE_DECIMAL),
                quantity: QUANTITY_PER_GRID,
                side: side,
                symbol: SYMBOL,
                timeInForce: "GTC"
            });
            logger.info(`[${SYMBOL}] ${side} ${QUANTITY_PER_GRID}_${price.toFixed(PRICE_DECIMAL)}`);
            
            if (notice && TG_BOT_API_TOKEN) {
                const bot = new TgBot(TG_BOT_API_TOKEN, TG_TARGET_CHAT_ID);
                bot.notify(`[${SYMBOL}] Grid order executed: ${side} ${QUANTITY_PER_GRID}@${price.toFixed(PRICE_DECIMAL)}`, 
                    { parse_mode: "html" });
            }
            return true;
        } catch (error) {
            logger.error(`[${SYMBOL}] Failed to execute order: ${error}`);
            return false;
        }
    };

    // Place initial grid orders
    for (let i = 0; i < orders.length; i++) {
        const success = await orderExecute(i, orders[i], orders[i] < lastPrice ? 'Bid' : 'Ask');
        if (!success) {
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s before retrying
            i--; // Retry the same order
        }
    }

    // Listen for order updates
    connection.onOrderUpdate(async (orderUpdate: any) => {
        try {
            if (orderUpdate.e === 'orderFill') {
                const clientId = parseInt(orderUpdate.c || '-1');
                if (clientId < 0 || clientId >= orders.length - 1) {
                    return;
                }

                const side = orderUpdate.S;
                const price = parseFloat(orderUpdate.p);
                const newClientId = side === 'Bid' ? clientId + 1 : clientId - 1;

                // Check if we need to place a new order
                try {
                    const existingOrder = await connection.apiCall("orderQuery", { 
                        symbol: SYMBOL, 
                        clientId: newClientId
                    });

                    if (!existingOrder) {
                        let success = false;
                        let retries = 0;
                        const maxRetries = 10;

                        while (!success && retries < maxRetries) {
                            success = await orderExecute(
                                newClientId,
                                orders[newClientId],
                                side === "Bid" ? "Ask" : "Bid",
                                true
                            );

                            if (!success) {
                                await new Promise(resolve => setTimeout(resolve, 5000));
                                retries++;
                            }
                        }

                        if (!success) {
                            logger.error(`[${SYMBOL}] Failed to place order after ${maxRetries} retries`);
                        }
                    }
                } catch (error) {
                    logger.error(`[${SYMBOL}] Error checking existing order: ${error}`);
                }
            }
        } catch (error) {
            logger.error(`[${SYMBOL}] Error processing order update: ${error}`);
        }
    });

    // Start telegram bot notifications
    bot_notify();
};

run();
