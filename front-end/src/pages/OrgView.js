import React, { useEffect, useState } from "react";
import { makeStyles } from "@material-ui/core/styles";
import Grid from "@material-ui/core/Grid";
import { connect } from "react-redux";
import Eosio from "../services/Eosio";
import TransactionsTable from "../components/TransactionsTable";
import OrgViewProfile from "../components/OrgViewProfile";
import OrgMembers from "../components/OrgMembers";

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

function OrgView(props) {
  const classes = useStyles();

  const [state, setState] = useState({
    accountName: props.match.params.accountName,
    name: null,
    isMyAccount: false,
    actions: [],
    organizations: [],
    memberGroups: [],
    permissions: []
  });

  const [memberGroup, setMemberGroup] = useState({
    selected: null,
    members: []
  });

  const selectMemberGroup = (selectedGroupName) => {
    const selected = selectedGroupName === memberGroup.selected ? null : selectedGroupName;
    let members = []
    if (selected) {
      // console.log(state.permissions)
      let permission = state.permissions.filter( (perm) => perm.perm_name === selectedGroupName)[0];
      for(let account of permission.required_auth.accounts) {
        members.push({
          name: account.permission.actor,
          type: "person"
        })
      }
    }

    setMemberGroup({
      selected: selected,
      members: members
    })
  };

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
      let accountRes = await eosio.dfuseClient.apiRequest("/v1/chain/get_account", "POST", null, {account_name: state.accountName})
      let actionsRes = await eosio.dfuseClient.searchTransactions("account:"+state.accountName);
      // let actionsRes = await eosio.rpc.history_get_actions(
      //   state.accountName,
      //   -1,
      //   -100
      // );
      let actionsToSet = [];

      // TODO: use Promise.all()
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
          // actionToPush.auth = action.action_trace.act.authorization[0].actor;
          // TODO: get key
          console.log(action);
          // const publicKey = ""
          // let keyRes = await eosio.dfuseClient.stateKeyAccounts(publicKey);
          // actionToPush.auth = keyRes.account_names[0];
          actionsToSet.push(actionToPush);
        }
      }

      let memberGroups = [];
      for (let perm1 of accountRes.permissions) {
        let level = 1;
        function checkParentPerm(perm2) {
          if (perm2.perm_name === "owner") return;
          level++;
          let parent = accountRes.permissions.filter( (perm3) => perm3.perm_name === perm2.parent)[0]
          checkParentPerm(parent);
        }
        checkParentPerm(perm1);
        memberGroups.push({
          name: perm1.perm_name,
          level: level
        })
      }
      memberGroups.sort((a, b) => a.level > b.level)

      setState({
        accountName: state.accountName,
        name: accountRes.name,
        isMyAccount: loggedinAccount === state.accountName,
        actions: actionsToSet,
        organizations: accountRes.organizations,
        memberGroups: memberGroups,
        permissions: accountRes.permissions
      });
    }

    getAccount();
  }, [props.eosio, state.accountName]);

  return (
    <Grid container className={classes.root} spacing={0}>
      <Grid key={0} item xs={6}>
        <OrgViewProfile
          accountName={state.accountName}
          name={state.name}
          isMyAccount={state.isMyAccount}
          organizations={state.organizations}
          description="Duis accumsan venenatis dui, tristique rhoncus elit posuere ut. Vivamus erat lacus, rutrum et iaculis sed, interdum vitae purus. Aliquam turpis nisl, dictum ac mi vel, eleifend placerat sapien."
          selectMemberGroup={selectMemberGroup}
          memberGroups={state.memberGroups}
        />
      </Grid>
      <Grid key={1} item xs={6}>
        {!memberGroup.selected && (
          <TransactionsTable
            accountName={state.accountName}
            transactions={state.actions}
            history={props.history}
            org
          />
        )}
        {memberGroup.selected && (
          <OrgMembers
            groupName={memberGroup.selected}
            members={memberGroup.members}
          />
        )}
      </Grid>
    </Grid>
  );
}

function getType(actionToPush, actionName, actionData) {
  let data;
  if (actionName === "transfer") {
    if (actionToPush.direction === "inbound") {
      data = "Received " + actionData.quantity;
      actionToPush.account = actionData.from;
    }
    else {
      data = "Sent " + actionData.quantity;
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


export default connect(mapStateToProps)(OrgView);
