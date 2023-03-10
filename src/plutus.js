// From <https://gitlab.com/_superhero1/plutusdex-enhancer/-/blob/main/content.js>
// Thank you!

module.exports = {
    getPlutusData: async function (token) {
        return await Promise.all([getStatements(token), getRewards(token), getOrders(token), getWithdrawals, getTransactions(token)]).then(function (values) {
            return {
                "statements": values[0],
                "rewards": values[1],
                "orders": values[2],
                "withdrawals": values[3],
                "transactions": values[4],
            }
        });
    }
}

async function getStatements(token) {
    var myHeaders = new Headers();
    myHeaders.append("Authorization", "Bearer " + token);
    myHeaders.append("Content-Type", "application/json");

    var raw = "{\"operationName\":\"transactions_view\",\"variables\":{\"offset\":0,\"limit\":null,\"from\":null,\"to\":null},\"query\":\"query transactions_view($offset: Int, $limit: Int, $from: timestamptz, $to: timestamptz) {\\n  transactions_view_aggregate(\\n    where: {_and: [{date: {_gte: $from}}, {date: {_lte: $to}}]}\\n  ) {\\n    aggregate {\\n      totalCount: count\\n      __typename\\n    }\\n    __typename\\n  }\\n  transactions_view(\\n    order_by: {date: desc}\\n    limit: $limit\\n    offset: $offset\\n    where: {_and: [{date: {_gte: $from}}, {date: {_lte: $to}}]}\\n  ) {\\n    id\\n    model\\n    user_id\\n    currency\\n    amount\\n    date\\n    type\\n    is_debit\\n    description\\n    __typename\\n  }\\n}\\n\"}";

    var requestOptions = {
        method: 'POST',
        headers: myHeaders,
        body: raw,
        redirect: 'follow'
    };

    return await fetch("https://hasura.plutus.it/v1alpha1/graphql", requestOptions)
        .then(response => response.json())
        .then(jsonResponse => { return jsonResponse.data.transactions_view; })
        .then(json => _fixStatements(json))
        .catch(err => console.warn(err));
}

function _fixStatements(json) {
    json.forEach(function (record) {
        switch (record.type) {
            case "0":
                record.type = "PENDING";
                break;
            case "5":
                record.type = "DECLINED_POS_CHARGE";
                break;
            case "29":
                record.type = "CARD_DEPOSIT";
                break;
            case "31":
                record.type = "PURCHASE";
                break;
            case "45":
                record.type = "REFUND";
                break;
        }
    });
    return json
}

async function getRewards(token) {
    var myHeaders = new Headers();
    myHeaders.append("Authorization", "Bearer " + token);

    var requestOptions = {
        method: 'GET',
        headers: myHeaders,
        redirect: 'follow'
    };

    return await fetch("https://api.plutus.it/platform/transactions/pluton", requestOptions)
        .then(response => response.json())
        .then(jsonResponse => { return jsonResponse; })
        .catch(err => console.warn(err));
}

async function getOrders(token) {
    var myHeaders = new Headers();
    myHeaders.append("Authorization", "Bearer " + token);
    myHeaders.append("Content-Type", "application/json");

    var raw = "{\"variables\":{},\"extensions\":{},\"operationName\":null,\"query\":\"query { crypto_orders_view(\\n    order_by: {created_at: desc}\\n) {\\n    id\\n    model\\n    wallet\\n    status\\n    crypto_amount\\n    crypto_currency\\n    fiat_amount\\n    fiat_currency\\n    created_at\\n    updated_at\\n    __typename\\n  }\\n}\\n\"}";

    var requestOptions = {
        method: 'POST',
        headers: myHeaders,
        body: raw,
        redirect: 'follow'
    };

    return await fetch("https://hasura.plutus.it/v1alpha1/graphql", requestOptions)
        .then(response => response.json())
        .then(jsonResponse => { return jsonResponse.data.crypto_orders_view; })
        .catch(err => console.warn(err));
}

async function getWithdrawals(token) {
    var myHeaders = new Headers();
    myHeaders.append("Authorization", "Bearer " + token);
    myHeaders.append("Content-Type", "application/json");

    var raw = "{\"operationName\":\"withdrawals\",\"variables\":{},\"query\":\"query withdrawals($status: enum_pluton_withdraw_requests_status) {\\n  pluton_withdraw_requests(\\n    order_by: {created_at: desc}\\n    where: {status: {_eq: $status}}\\n  ) {\\n    id\\n    address\\n    amount\\n    status\\n    payout_destination_type\\n    created_at\\n    clear_junction_transfer {\\n      amount\\n      currency\\n      __typename\\n    }\\n    card_transfer {\\n      amount\\n      currency\\n      __typename\\n    }\\n    __typename\\n  }\\n}\\n\"}";

    var requestOptions = {
        method: 'POST',
        headers: myHeaders,
        body: raw,
        redirect: 'follow'
    };

    return await fetch("https://hasura.plutus.it/v1alpha1/graphql", requestOptions)
        .then(response => response.json())
        .then(jsonResponse => { return jsonResponse.data.pluton_withdraw_requests; })
        .catch(err => console.warn(err));
}

async function getTransactions(token) {
    var myHeaders = new Headers();
    myHeaders.append("Authorization", "Bearer " + token);

    var requestOptions = {
        method: 'GET',
        headers: myHeaders,
        redirect: 'follow'
    };

    return await fetch("https://api.plutus.it/platform/transactions/contis", requestOptions)
        .then(response => response.json())
        .then(jsonResponse => { return jsonResponse; })
        .catch(err => console.warn(err));
}

