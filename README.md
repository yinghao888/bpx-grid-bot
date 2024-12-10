# Backpack Grid Trading Bot

A Backpack exchange grid trading bot that supports SOL/USDC trading pair.

## Features

- Automatically create buy and sell grids within the set price range.
- Dynamically detect account balance to ensure safe trading.
- Automatically execute grid trading strategy.
- Support Telegram notifications (optional).
- Real-time order status monitoring.
- Automatic order exception handling.

## Requirements

- Node.js 16.x or higher version.
- Yarn package manager.
- Backpack exchange account.
- Sufficient trading funds.

## Installation

1. Clone repository:
   ```bash
   git clone [repository-url]
   cd backpack-grid-bot
   ```

2. Install dependencies:
   ```bash
   yarn install
   ```

3. Configure environment variables:
   - Copy `.env.copy` to `.env`.
   - Fill in configuration items as instructed.

## Configuration

Configure the following parameters in `.env` file:

### Required Configuration

- `BACKPACK_API_KEY`: Backpack API Key.
- `BACKPACK_API_SECRET`: Backpack API Secret.
- `SYMBOL`: Trading pair name, currently "SOL_USDC".

### Strategy Configuration

- `LOWER_PRICE`: Grid lowest price, in USDC (e.g., 200).
- `UPPER_PRICE`: Grid highest price, in USDC (e.g., 2000).
- `PRICE_DECIMAL`: Price precision, recommended to set as 2.
- `NUMBER_OF_GRIDS`: Number of grids, recommended between 100-500.
- `QUANTITY_PER_GRID`: Quantity per grid, in SOL (e.g., 0.03).

### Optional Configuration

- `TELEGRAM_BOT_API_TOKEN`: Telegram bot API Token.
- `TELEGRAM_TARGET_CHAT_ID`: Telegram target chat ID.

## Funding Requirements

Before starting the bot, please ensure sufficient funds in your account:

1. SOL requirement: NUMBER_OF_GRIDS × QUANTITY_PER_GRID.
2. USDC requirement: NUMBER_OF_GRIDS × QUANTITY_PER_GRID × UPPER_PRICE.

For example, using default configuration:
- SOL requirement: 360 × 0.03 = 10.8 SOL.
- USDC requirement: 360 × 0.03 × 2000 = 21,600 USDC.

## Running the Bot

```bash
yarn start
```

## Notes

1. Please carefully check configuration parameters before first run.
2. Ensure sufficient funds in account, otherwise the bot will wait until funds are sufficient.
3. Recommend testing strategy with small funds first.
4. Monitor bot running status through Telegram (if configured).

## Risk Warning

- Grid trading strategy is suitable for oscillating markets, not for trending markets.
- Please set appropriate parameters according to your risk tolerance.
- Recommend testing strategy with small funds first.
- Market involves risks, invest with caution.

## License

MIT Source: https://github.com/pordria/backpack-grid-bot

## Sponsor

[https://backpack.exchange/refer/b](https://backpack.exchange/refer/b)

## Backpack Exchange API

Source: https://github.com/backpack-exchange/bpx-openapi

### Introduction

The Backpack Exchange API is designed for programmatic trade execution. All endpoints requiring state mutation need requests to be signed with an ED25519 keypair for authentication.

- REST API Base URL: `https://api.backpack.exchange/`
- WebSocket API URL: `wss://ws.backpack.exchange/`

### Authentication

Signed requests require the following headers:
- `X-Timestamp`: Unix time in milliseconds.
- `X-Window`: Time window in milliseconds (default: 5000, max: 60000).
- `X-API-Key`: Base64 encoded verifying key of the ED25519 keypair.
- `X-Signature`: Base64 encoded signature.

### Available Endpoints

#### Public Endpoints

1. **Market Data**
   - Get Ticker: `GET /api/v1/ticker`.
   - Get Mark Price: `GET /api/v1/markPrice`.
   - Get Open Interest: `GET /api/v1/openInterest`.

2. **Assets & Markets**
   - Get Assets: `GET /api/v1/assets`.
   - Get Markets: `GET /api/v1/markets`.
   - Get Collateral: `GET /api/v1/collateral`.

3. **Borrow/Lend Markets**
   - Get Markets: `GET /api/v1/borrowLend/markets`.

#### Private Endpoints

1. **Account Management**
   - Get Account: `GET /api/v1/account`.
   - Get Position: `GET /api/v1/position`.
   - Get Collateral: `GET /api/v1/capital/collateral`.

2. **Order Management**
   - Place Order: `POST /api/v1/order`.
   - Get Open Orders: `GET /api/v1/orders`.
   - Cancel Order: `DELETE /api/v1/order`.
   - Cancel All Orders: `DELETE /api/v1/orders`.

3. **History**
   - Order History: `GET /wapi/v1/history/orders`.
   - Fill History: `GET /wapi/v1/history/fills`.
   - PnL History: `GET /wapi/v1/history/pnl`.
   - Funding History: `GET /wapi/v1/history/funding`.
   - Borrow History: `GET /wapi/v1/history/borrowLend`.
   - Interest History: `GET /wapi/v1/history/interest`.

4. **Capital Management**
   - Get Deposit Address: `GET /wapi/v1/capital/deposit/address`.
   - Get Deposits: `GET /wapi/v1/capital/deposits`.
   - Get Withdrawals: `GET /wapi/v1/capital/withdrawals`.
   - Request Withdrawal: `POST /wapi/v1/capital/withdrawals`.

### WebSocket Streams

Connect to `wss://ws.backpack.exchange` to access real-time data streams.

#### Public Streams
- Trade Stream: `trades.<symbol>`.
- Ticker Stream: `ticker.<symbol>`.
- Depth Stream: `depth.<symbol>`.
- Kline Stream: `kline.<interval>.<symbol>`.
- Mark Price Stream: `markPrice.<symbol>`.

#### Private Streams (Requires Authentication)
- Order Updates: `account.orderUpdate`.
- Position Updates: `account.positionUpdate`.
- Balance Updates: `account.balanceUpdate`.

### Recent Changes (as of 2024-12-03)
- Added order expiry reason to order update stream.
- Added `cumulativeInterest` to borrow lend position.
- Added borrow lend history per position endpoint.
- Added `timestamp` field to depth endpoint.
- Converted all error responses to JSON with error codes.