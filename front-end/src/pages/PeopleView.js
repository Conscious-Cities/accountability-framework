import React, { useEffect, useState } from "react";
import { makeStyles } from "@material-ui/core/styles";
import Grid from "@material-ui/core/Grid";
import { connect } from "react-redux";
import Eosio from "../services/Eosio";
import TransactionsTable from "../components/TransactionsTable";
import PeopleViewProfile from "../components/PeopleViewProfile";
import { useHistory } from "react-router-dom";

function mapStateToProps(state) {
  return {
    eosio: state.eosio,
  };
}

const useStyles = makeStyles((theme) => ({
  root: {
    flexGrow: 1,
  },
  control: {
    padding: theme.spacing(2),
  },
}));

function PeopleView(props) {
  const classes = useStyles();

  const [state, setState] = useState({
    accountName: props.match.params.accountName,
    name: null,
    isMyAccount: false,
    actions: [],
    organizations: []
  });

  const history = useHistory();

  useEffect(() => {
    let eosio;
    let loggedinAccount;
    if (props.eosio) {
      eosio = props.eosio;
      loggedinAccount = eosio.account.name;
    } else {
      eosio = new Eosio();
    }

    async function getAccount() {
      let accountRes = await eosio.rpc.get_account(state.accountName);
      if(accountRes.accountType === "organization") {
        const orgPath = '/org/' + state.accountName;
        history.push(orgPath);
      }

      let actionsRes = await eosio.rpc.history_get_actions(
        state.accountName,
        -1,
        -100
      );
      let actionsToSet = [];
      console.log(actionsRes)
      for (let action of actionsRes.actions) {
        // console.log(action.action_trace.trx_id, action.action_trace.act.account, action.action_trace.act.name,
        //   action.account_action_seq, // increases when new action in transaction. start 1
        //   action.global_action_seq,
        //   action.action_trace.action_ordinal, // increases when new action in transaction. start 1
        //   action.action_trace.creator_action_ordinal // increases for all new actions including inline action. start 0
        //   )
        // Only look at top level actions, no inline actions
        if (
          !action.action_trace.error_code
          // && action.action_trace.creator_action_ordinal === 0
        ) {
          let actionToPush = {
            tx_id: action.action_trace.trx_id,
            timestamp: action.block_time,
            account: action.action_trace.act.account,
          };
          const auth = action.action_trace.act.authorization[0].actor;
          if (auth === actionToPush.account) actionToPush.direction = "self";
          else if (auth === state.accountName)
            actionToPush.direction = "outbound";
          else actionToPush.direction = "inbound";

          const [type, data] = getType(
            actionToPush,
            action.action_trace.act.name,
            action.action_trace.act.data
          );
          actionToPush.type = type;
          actionToPush.data = data;
          actionsToSet.push(actionToPush);
        }
      }

      setState({
        accountName: state.accountName,
        name: accountRes.name,
        isMyAccount: loggedinAccount === state.accountName,
        actions: actionsToSet,
        organizations: accountRes.organizations,
      });
    }

    getAccount();
  }, [props.eosio, state.accountName, history]);

  return (
    <Grid container className={classes.root} spacing={0}>
      <Grid key={0} item xs={6}>
        <PeopleViewProfile
          accountName={state.accountName}
          name={state.name}
          isMyAccount={state.isMyAccount}
          organizations={state.organizations}
          history={props.history}
        />
      </Grid>
      <Grid key={1} item xs={6}>
        <TransactionsTable
          accountName={state.accountName}
          transactions={state.actions}
          history={props.history}
          org={false}
        />
      </Grid>
    </Grid>
  );
}

function getType(actionToPush, actionName, actionData) {
  let data;
  if (actionName === "transfer") {
    if (actionToPush.direction === "inbound") {
      data = "Received " + actionData.quantity + " from " + actionData.from;
      actionToPush.account = actionData.from;
    }
    else {
      data = "Sent " + actionData.quantity + " to " + actionData.to;
      actionToPush.account = actionData.to;
    }
    return ["payment", data];
  }
  if (actionToPush.account === "eosio") {
    if (actionName === "setcode") return ["contract", ""];
    if (actionName === "newperson") {
      data = actionData.name + " joined Conscious Cities";
      return ["account", data];
    }
    if (actionName === "neworg") {
      data = 'New organization "' + actionData.name + '" was created';
      return ["account", data];
    }
    if (actionName === "policyvote") {
      data = "Voted '" + actionData.vote + "' on policy " + actionData.policy_id;
      return ["vote", data];
    }
    return ["other", ""];
  } else return ["other", ""];
}

export default connect(mapStateToProps)(PeopleView);
