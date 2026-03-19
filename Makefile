SHELL=/bin/bash

local: index.bs
	bikeshed --die-on=warning spec index.bs index.html

index.html: index.bs
	@ (HTTP_STATUS=$$(curl https://www.w3.org/publications/spec-generator/ \
	                       --output index.html \
	                       --write-out "%{http_code}" \
	                       --header "Accept: text/plain, text/html" \
	                       -F type=bikeshed-spec \
	                       -F die-on=warning \
	                       -F file=@index.bs) && \
	[[ "$$HTTP_STATUS" -eq "200" ]]) || ( \
		echo ""; cat index.html; echo ""; \
		rm -f index.html; \
		exit 22 \
	);

remote: index.html

ci: index.bs
	mkdir -p out
	make remote
	mv index.html out/index.html

clean:
	rm index.html


