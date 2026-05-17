# ACO Bootstrap Acceptance Scenarios

## Scenario: Bootstrap manifest exists

Given the bootstrap script has run
When the manifest is opened
Then every required repository has an entry
And each entry has name, url, localPath, role, cloneStatus, and waiverRequired

## Scenario: Existing dirty repository is not modified

Given a required upstream repository already exists
And it has uncommitted changes
When bootstrap runs with --ff-only
Then the repository is not reset, cleaned, or overwritten
And the manifest marks it dirty
And cloneStatus is blocked

## Scenario: Failed clone does not stop all bootstrap work

Given one repository fails to clone
When bootstrap runs
Then the script continues with the remaining repositories
And the failed repository has cloneStatus=failed
And waiverRequired=true

## Scenario: Package scripts exist

Given package.json exists
When the bootstrap input completes
Then package.json contains scripts for research:bootstrap, research:update-upstreams, research:graph, research:merge-graphs, and research:validate-corpus
Or equivalent aco-prefixed scripts if naming conflicts exist

## Scenario: Research workspace is gitignored

Given the research workspace exists
When git status runs
Then research/upstreams, research/graphs, research/merged, and graphify-out are not staged or shown as untracked repository contents
