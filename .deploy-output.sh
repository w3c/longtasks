#!/bin/bash
set -ev
STATUS=`git log -1 --pretty=oneline`

cp index.html save.html

git checkout gh-pages

git init
git config user.name "Travis-CI"
git config user.email "travis-ci"

mv save.html index.html
git add index.html
git commit -m "Built by Travis-CI: $STATUS"
git status

GH_REPO="@github.com/w3c/html.git"
FULL_REPO="https://$GH_TOKEN$GH_REPO"
git push --quiet $FULL_REPO master:gh-pages
