import {useQuery, gql} from '@apollo/client';
import {NonIdealState} from '@blueprintjs/core';
import {IconNames} from '@blueprintjs/icons';
import React from 'react';

import {PythonErrorInfo, PYTHON_ERROR_FRAGMENT} from '../app/PythonErrorInfo';
import {useDocumentTitle} from '../hooks/useDocumentTitle';
import {INSTANCE_HEALTH_FRAGMENT} from '../instance/InstanceHealthFragment';
import {JOB_STATE_FRAGMENT} from '../jobs/JobUtils';
import {UnloadableSensors} from '../jobs/UnloadableJobs';
import {JobType} from '../types/globalTypes';
import {Group} from '../ui/Group';
import {Loading} from '../ui/Loading';
import {Page} from '../ui/Page';
import {repoAddressToSelector} from '../workspace/repoAddressToSelector';
import {RepoAddress} from '../workspace/types';

import {SENSOR_FRAGMENT} from './SensorFragment';
import {SensorInfo} from './SensorInfo';
import {SensorsTable} from './SensorsTable';
import {SensorsRootQuery} from './types/SensorsRootQuery';

interface Props {
  repoAddress: RepoAddress;
}

export const SensorsRoot = (props: Props) => {
  const {repoAddress} = props;
  useDocumentTitle('Sensors');
  const repositorySelector = repoAddressToSelector(repoAddress);

  const queryResult = useQuery<SensorsRootQuery>(SENSORS_ROOT_QUERY, {
    variables: {
      repositorySelector: repositorySelector,
      jobType: JobType.SENSOR,
    },
    fetchPolicy: 'cache-and-network',
    pollInterval: 50 * 1000,
    partialRefetch: true,
  });

  return (
    <Page>
      <Loading queryResult={queryResult} allowStaleData={true}>
        {(result) => {
          const {sensorsOrError, unloadableJobStatesOrError, instance} = result;
          const content = () => {
            if (sensorsOrError.__typename === 'PythonError') {
              return <PythonErrorInfo error={sensorsOrError} />;
            } else if (unloadableJobStatesOrError.__typename === 'PythonError') {
              return <PythonErrorInfo error={unloadableJobStatesOrError} />;
            } else if (sensorsOrError.__typename === 'RepositoryNotFoundError') {
              return (
                <NonIdealState
                  icon={IconNames.ERROR}
                  title="Repository not found"
                  description="Could not load this repository."
                />
              );
            } else if (!sensorsOrError.results.length) {
              return (
                <NonIdealState
                  icon={IconNames.AUTOMATIC_UPDATES}
                  title="No Sensors Found"
                  description={
                    <p>
                      This repository does not have any sensors defined. Visit the{' '}
                      <a
                        href="https://docs.dagster.io/overview/schedules-sensors/sensors"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        sensors documentation
                      </a>{' '}
                      for more information about creating sensors in Dagster.
                    </p>
                  }
                />
              );
            } else {
              return (
                <Group direction="column" spacing={20}>
                  {sensorsOrError.results.length > 0 && (
                    <SensorInfo daemonHealth={instance.daemonHealth} />
                  )}
                  <SensorsTable repoAddress={repoAddress} sensors={sensorsOrError.results} />
                  <UnloadableSensors sensorStates={unloadableJobStatesOrError.results} />
                </Group>
              );
            }
          };

          return <div>{content()}</div>;
        }}
      </Loading>
    </Page>
  );
};

const SENSORS_ROOT_QUERY = gql`
  query SensorsRootQuery($repositorySelector: RepositorySelector!, $jobType: JobType!) {
    sensorsOrError(repositorySelector: $repositorySelector) {
      __typename
      ...PythonErrorFragment
      ... on Sensors {
        results {
          id
          ...SensorFragment
        }
      }
    }
    unloadableJobStatesOrError(jobType: $jobType) {
      ... on JobStates {
        results {
          id
          ...JobStateFragment
        }
      }
      ...PythonErrorFragment
    }
    instance {
      ...InstanceHealthFragment
    }
  }
  ${PYTHON_ERROR_FRAGMENT}
  ${JOB_STATE_FRAGMENT}
  ${SENSOR_FRAGMENT}
  ${INSTANCE_HEALTH_FRAGMENT}
`;
