// Adapted from <https://gitlab.com/_superhero1/plutusdex-enhancer/-/blob/main/content.js>
// Thank you!

module.exports = {
    getPlutusData: async function (token) {
        return await Promise.all([getStatements(token), getRewards(token), getOrders(token), getWithdrawals, getTransactions(token), getCardBalance(token), getBaseBalance(token)]).then(function (values) {
            return {
                "statements": values[0],
                "rewards": values[1],
                "orders": values[2],
                "withdrawals": values[3],
                "transactions": values[4],
                "cardAccount": values[5],
                "baseAccount": values[6]
            }
        });
    }
}

function getRequestOptions(token, method, body) {
    const myHeaders = new Headers();
    myHeaders.append("Authorization", "Bearer " + token);
    myHeaders.append("Content-Type", "application/json");

    const requestOptions = {
        method: method,
        headers: myHeaders,
        redirect: 'follow',
        body: body
    };

    return requestOptions;
}

async function getBaseBalance(token) {
    const raw = `{"operationName":"getBalance","variables":{"currency":"EUR"},"query":"query getBalance($currency: enum_fiat_balance_currency!) {\n  fiat_balance(where: {currency: {_eq: $currency}}) {\n    id\n    user_id\n    currency\n    amount\n    created_at\n    updated_at\n    __typename\n  }\n}\n"}`;

    const requestOptions = getRequestOptions(token, 'POST', raw);

    return await fetch("https://hasura.plutus.it/v1alpha1/graphql", requestOptions)
        .then(response => response.json())
        .then(jsonResponse => { return jsonResponse.data.fiat_balance[0] })
}

async function getCardBalance(token) {
    const requestOptions = getRequestOptions(token, 'GET', null);

    return await fetch("https://api.plutus.it/platform/consumer/balance", requestOptions)
        .then(response => response.json())
        .then(jsonResponse => { return jsonResponse; })
}

async function getStatements(token) {
    const raw = "{\"operationName\":\"transactions_view\",\"variables\":{\"offset\":0,\"limit\":null,\"from\":null,\"to\":null},\"query\":\"query transactions_view($offset: Int, $limit: Int, $from: timestamptz, $to: timestamptz) {\\n  transactions_view_aggregate(\\n    where: {_and: [{date: {_gte: $from}}, {date: {_lte: $to}}]}\\n  ) {\\n    aggregate {\\n      totalCount: count\\n      __typename\\n    }\\n    __typename\\n  }\\n  transactions_view(\\n    order_by: {date: desc}\\n    limit: $limit\\n    offset: $offset\\n    where: {_and: [{date: {_gte: $from}}, {date: {_lte: $to}}]}\\n  ) {\\n    id\\n    model\\n    user_id\\n    currency\\n    amount\\n    date\\n    type\\n    is_debit\\n    description\\n    __typename\\n  }\\n}\\n\"}";

    const requestOptions = getRequestOptions(token, 'POST', raw);

    return await fetch("https://hasura.plutus.it/v1alpha1/graphql", requestOptions)
        .then(response => response.json())
        .then(jsonResponse => { return jsonResponse.data.transactions_view; })
        .then(json => _fixStatements(json))
}

function _fixStatements(json) {
    const types = {
        "0": "PENDING",
        "5": "DECLINED_POS_CHARGE",
        "29": "CARD_DEPOSIT",
        "31": "PURCHASE",
        "35": "REFUND",
        "45": "REFUND",
    };
    json.forEach(function (record) {
        if (record.type in types)
            record.type = types[record.type];
        else
            record.type = "UNKNOWN - " + record.type;
    });
    return json
}

async function getRewards(token) {
    const requestOptions = getRequestOptions(token, 'GET', null);

    return await fetch("https://api.plutus.it/platform/transactions/pluton", requestOptions)
        .then(response => response.json())
        .then(jsonResponse => { return jsonResponse; })
}

async function getOrders(token) {
    const raw = "{\"variables\":{},\"extensions\":{},\"operationName\":null,\"query\":\"query { crypto_orders_view(\\n    order_by: {created_at: desc}\\n) {\\n    id\\n    model\\n    wallet\\n    status\\n    crypto_amount\\n    crypto_currency\\n    fiat_amount\\n    fiat_currency\\n    created_at\\n    updated_at\\n    __typename\\n  }\\n}\\n\"}";

    const requestOptions = getRequestOptions(token, 'POST', raw);

    return await fetch("https://hasura.plutus.it/v1alpha1/graphql", requestOptions)
        .then(response => response.json())
        .then(jsonResponse => { return jsonResponse.data.crypto_orders_view; })
}

async function getWithdrawals(token) {
    const raw = "{\"operationName\":\"withdrawals\",\"variables\":{},\"query\":\"query withdrawals($status: enum_pluton_withdraw_requests_status) {\\n  pluton_withdraw_requests(\\n    order_by: {created_at: desc}\\n    where: {status: {_eq: $status}}\\n  ) {\\n    id\\n    address\\n    amount\\n    status\\n    payout_destination_type\\n    created_at\\n    clear_junction_transfer {\\n      amount\\n      currency\\n      __typename\\n    }\\n    card_transfer {\\n      amount\\n      currency\\n      __typename\\n    }\\n    __typename\\n  }\\n}\\n\"}";

    const requestOptions = getRequestOptions(token, 'POST', raw);

    return await fetch("https://hasura.plutus.it/v1alpha1/graphql", requestOptions)
        .then(response => response.json())
        .then(jsonResponse => { return jsonResponse.data.pluton_withdraw_requests; })
}

async function getTransactions(token) {
    const requestOptions = getRequestOptions(token, 'GET', null);

    return await fetch("https://api.plutus.it/platform/transactions/contis", requestOptions)
        .then(response => response.json())
        .then(jsonResponse => { return jsonResponse; })
}