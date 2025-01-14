import '@blueprintjs/core/lib/css/blueprint.css';
import '@blueprintjs/icons/lib/css/blueprint-icons.css';
import '@blueprintjs/select/lib/css/blueprint-select.css';
import '@blueprintjs/table/lib/css/table.css';
import '@blueprintjs/popover2/lib/css/blueprint-popover2.css';

import {ApolloLink, ApolloClient, ApolloProvider} from '@apollo/client';
import {WebSocketLink} from '@apollo/client/link/ws';
import {Colors} from '@blueprintjs/core';
import * as React from 'react';
import {BrowserRouter} from 'react-router-dom';
import {createGlobalStyle} from 'styled-components/macro';
import {SubscriptionClient} from 'subscriptions-transport-ws';

import {FontFamily} from '../ui/styles';
import {WorkspaceProvider} from '../workspace/WorkspaceContext';

import {AppCache} from './AppCache';
import {AppContext} from './AppContext';
import {AppErrorLink} from './AppError';
import {CustomAlertProvider} from './CustomAlertProvider';
import {CustomConfirmationProvider} from './CustomConfirmationProvider';
import {CustomTooltipProvider} from './CustomTooltipProvider';
import {LayoutProvider} from './LayoutProvider';
import {formatElapsedTime, patchCopyToRemoveZeroWidthUnderscores, debugLog} from './Util';
import {WebsocketStatusProvider} from './WebsocketStatus';
import {TimezoneProvider} from './time/TimezoneContext';

// The solid sidebar and other UI elements insert zero-width spaces so solid names
// break on underscores rather than arbitrary characters, but we need to remove these
// when you copy-paste so they don't get pasted into editors, etc.
patchCopyToRemoveZeroWidthUnderscores();

const GlobalStyle = createGlobalStyle`
  * {
    box-sizing: border-box;
  }

  html, body, #root {
    color: ${Colors.DARK_GRAY4};
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    display: flex;
    flex: 1 1;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  #root {
    display: flex;
    flex-direction: column;
    align-items: stretch;
  }

  body {
    margin: 0;
    padding: 0;
  }

  body, button, input, select, textarea {
    font-family: ${FontFamily.default};
  }

  code, pre {
    font-family: ${FontFamily.monospace};
  }
`;

interface Props {
  config: {
    graphqlURI: string;
    basePath?: string;
    subscriptionParams?: {[key: string]: string};
  };
}

export const AppProvider: React.FC<Props> = (props) => {
  const {basePath = '', subscriptionParams = {}, graphqlURI} = props.config;

  const websocketURI =
    graphqlURI ||
    `${document.location.protocol === 'https:' ? 'wss' : 'ws'}://${
      document.location.host
    }${basePath}/graphql`;

  // The address to the dagit server (eg: http://localhost:5000) based
  // on our current "GRAPHQL_URI" env var. Note there is no trailing slash.
  const rootServerURI = React.useMemo(
    () =>
      websocketURI
        .replace('wss://', 'https://')
        .replace('ws://', 'http://')
        .replace('/graphql', ''),
    [websocketURI],
  );

  const websocketClient = React.useMemo(() => {
    return new SubscriptionClient(websocketURI, {
      reconnect: true,
      lazy: true,
      connectionParams: subscriptionParams,
    });
  }, [subscriptionParams, websocketURI]);

  const apolloClient = React.useMemo(() => {
    const logLink = new ApolloLink((operation, forward) =>
      forward(operation).map((data) => {
        const time = performance.now() - operation.getContext().start;
        debugLog(`${operation.operationName} took ${formatElapsedTime(time)}`, {operation, data});
        return data;
      }),
    );

    const timeStartLink = new ApolloLink((operation, forward) => {
      operation.setContext({start: performance.now()});
      return forward(operation);
    });

    return new ApolloClient({
      cache: AppCache,
      link: ApolloLink.from([
        logLink,
        AppErrorLink(),
        timeStartLink,
        new WebSocketLink(websocketClient),
      ]),
    });
  }, [websocketClient]);

  const appContextValue = React.useMemo(
    () => ({
      basePath,
      rootServerURI,
      websocketURI,
    }),
    [basePath, rootServerURI, websocketURI],
  );

  return (
    <AppContext.Provider value={appContextValue}>
      <WebsocketStatusProvider websocket={websocketClient}>
        <GlobalStyle />
        <ApolloProvider client={apolloClient}>
          <BrowserRouter basename={basePath || ''}>
            <TimezoneProvider>
              <WorkspaceProvider>
                <CustomConfirmationProvider>
                  <LayoutProvider>{props.children}</LayoutProvider>
                </CustomConfirmationProvider>
                <CustomTooltipProvider />
                <CustomAlertProvider />
              </WorkspaceProvider>
            </TimezoneProvider>
          </BrowserRouter>
        </ApolloProvider>
      </WebsocketStatusProvider>
    </AppContext.Provider>
  );
};
