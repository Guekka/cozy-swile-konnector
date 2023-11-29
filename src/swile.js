module.exports = {
    getSwileData: async function (token) {
        return await Promise.all([getTransactions(token), getAccount(token)]).then(function (values) {
            return {
                transactions: values[0],
                account: values[1],
            };
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

async function getAccount(token) {
    const requestOptions = getRequestOptions(token, 'GET');

    return await fetch("https://customer-api.swile.co/api/v0/users/me", requestOptions)
        .then(response => response.json())
        .then(jsonResponse => jsonResponse["user"])
}

function _fixStatements(json) {
    const ALLOWED_TYPES = ["Payment", "Credit"];
    return json.filter(statement => ALLOWED_TYPES.includes(statement.display_type))
}

async function getTransactions(token) {
    const requestOptions = getRequestOptions(token, 'GET');

    return await fetch("https://neobank-api.swile.co/api/v2/user/operations?per=999999", requestOptions)
        .then(response => response.json())
        .then(json => json.items)
        .then(_fixStatements)
}
