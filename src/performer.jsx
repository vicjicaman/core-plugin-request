import _ from "lodash";
import * as IO from "./io";

export const link = (performer, performers, { onLinked }) => {
  const { dependents } = performer;

  for (const depSrv of dependents) {
    const depSrvPerformer = _.find(performers, {
      performerid: depSrv.moduleid
    });

    if (depSrvPerformer) {
      if (depSrvPerformer.linked) {
        onLinked(depSrvPerformer);
      }
    }
  }
};

export const sendLinkStateEvents = (performer, performers, cxt) => {
  const { dependents } = performer;

  for (const depSrv of dependents) {
    const depSrvPerformer = _.find(performers, {
      performerid: depSrv.moduleid
    });

    if (depSrvPerformer) {
      IO.sendEvent(
        "out",
        {
          data: "Performing dependent found " + depSrv.moduleid
        },
        cxt
      );

      if (depSrvPerformer.linked) {
        IO.sendEvent(
          "info",
          {
            data: " - Linked " + depSrv.moduleid
          },
          cxt
        );
      } else {
        IO.sendEvent(
          "warning",
          {
            data: " - Not linked " + depSrv.moduleid
          },
          cxt
        );
      }
    }
  }
};
