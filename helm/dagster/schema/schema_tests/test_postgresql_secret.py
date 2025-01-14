import subprocess

import pytest
from kubernetes.client import models
from schema.charts.dagster.values import DagsterHelmValues

from .helm_template import HelmTemplate


@pytest.fixture(name="template")
def helm_template() -> HelmTemplate:
    return HelmTemplate(
        output="templates/secret-postgres.yaml",
        model=models.V1Secret,
    )


def test_postgresql_secret_does_not_render(template: HelmTemplate, capsys):
    with pytest.raises(subprocess.CalledProcessError):
        helm_values_generate_postgresql_secret_disabled = DagsterHelmValues.construct(
            generatePostgresqlPasswordSecret=False
        )

        template.render(helm_values_generate_postgresql_secret_disabled)

        _, err = capsys.readouterr()
        assert "Error: could not find template" in err


def test_postgresql_secret_renders(template: HelmTemplate):
    helm_values_generate_postgresql_secret_enabled = DagsterHelmValues.construct(
        generatePostgresqlPasswordSecret=True
    )

    secrets = template.render(helm_values_generate_postgresql_secret_enabled)

    assert len(secrets) == 1
