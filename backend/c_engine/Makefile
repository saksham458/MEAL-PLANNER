# Linux/Mac build
# gcc -shared -fPIC -O2 -o grocery_sort.so grocery_sort.c

.PHONY: all clean

all:
	gcc -shared -fPIC -O2 -o grocery_sort.so grocery_sort.c
	@echo "✅ Built grocery_sort.so"

windows:
	gcc -shared -O2 -o grocery_sort.dll grocery_sort.c
	@echo "✅ Built grocery_sort.dll"

clean:
	rm -f grocery_sort.so grocery_sort.dll
