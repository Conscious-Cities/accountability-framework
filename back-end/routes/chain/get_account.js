const accountController = require('../../controllers/accounts.controller');

/* GET acounts listing. */
module.exports = async function (req, res) {
  if (!req.body.account_name) {
    res.status(400);
    res.send({ message: 'req body should contain all the data!' });
    return;
  }

  const accountDoc = await accountController.findOne({ accountName: req.body.account_name });
  
  if (!accountDoc) {
    res.status(404);
    res.send({ message: "Not found account with account name " + req.body.account_name });
    return; // not sure if this is needed...
  }

  accountDocInfo = {
    accountType: accountDoc.accountType,
    organizations: accountDoc.organizations
  };
  
  req.blockchainResSent = true;
  let retObj = req.addBlockchainRes(accountDocInfo);
  res.send(retObj);
};