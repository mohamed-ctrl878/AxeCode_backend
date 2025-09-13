#!/bin/bash

# Set resource limits
ulimit -t 5        # CPU time in seconds
ulimit -v 512000   # Virtual memory in KB (500MB)
ulimit -f 1024     # File size in KB
ulimit -u 50       # Max user processes

# Compile the code
g++ -std=c++17 -O2 -fno-asm -Wno-everything -I. \
    -static-libgcc -static-libstdc++ \
    -D_GLIBCXX_DEBUG -D_GLIBCXX_DEBUG_PEDANTIC \
    /home/coderunner/workspace/code.cpp -o /home/coderunner/workspace/program

# Check compilation status
if [ $? -ne 0 ]; then
    echo "Compilation Error"
    exit 1
fi

# Run the program with timeout
timeout 5s /home/coderunner/workspace/program
