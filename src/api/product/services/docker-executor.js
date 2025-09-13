'use strict';

const Docker = require('dockerode');
const path = require('path');
const fs = require('fs').promises;
const tar = require('tar-stream');

// Helper to normalize Windows paths for Docker
const normalizeWindowsPath = (windowsPath) => windowsPath.replace(/\\/g, '/');

// Helper to create a tar stream from source code
const createSourceTar = (sourceCode) => {
    const pack = tar.pack();
    pack.entry({ name: 'code.cpp' }, sourceCode);
    pack.finalize();
    return pack;
};

module.exports = ({ strapi }) => ({
    docker: null,
    config: {
        MAX_MEMORY_USAGE: 100 * 1024 * 1024,
        MAX_EXECUTION_TIME: 10000
    },

    async bootstrap() {
        this.docker = new Docker();
        await this.ensureImage();
    },

    async createWorkDir() {
        // Create temporary directory in the controllers directory
        const workDir = path.join(__dirname, '..', 'controllers', 'tmp', `job-${Date.now()}`);
        console.log('[Workspace] Creating directory at:', workDir);
        
        try {
            await fs.mkdir(workDir, { recursive: true });
            console.log('[Workspace] Directory created successfully');
            
            // Verify directory exists
            const stats = await fs.stat(workDir);
            console.log('[Workspace] Directory stats:', {
                isDirectory: stats.isDirectory(),
                permissions: stats.mode,
                size: stats.size
            });
            
            return workDir;
        } catch (error) {
            console.error('[Workspace] Error creating directory:', error);
            throw error;
        }
    },

    async execute(code, testCases) {
        console.log('\n=== Starting Docker Execution Process ===');
        
        // Step 1: Initialize Docker
        console.log('\n[Step 1] Initializing Docker...');
        if (!this.docker) {
            console.log('[Docker] Not initialized, running bootstrap...');
            await this.bootstrap();
        }
        console.log('[Docker] Initialization successful');
        console.log('[Docker] Instance status:', this.docker ? 'Available' : 'Not Available');
        
        let workDir;
        try {
            // Step 2: Setup workspace and files
            console.log('\n[Step 2] Setting up workspace and files...');
            workDir = await this.createWorkDir();
            
            const sourceFile = path.join(workDir, 'code.cpp');
            console.log('[Files] Writing source code to:', sourceFile);
            await fs.writeFile(sourceFile, code);
            
            // Debug block - host file diagnostics
            console.log('[DEBUG-HOST] hostSrcDir (raw):', workDir);
            console.log('[DEBUG-HOST] hostSrcDir (resolved):', path.resolve(workDir));

            try {
                const stat = await fs.stat(workDir);
                console.log('[DEBUG-HOST] hostSrcDir exists:', true, 'stat:', {
                    isDirectory: stat.isDirectory(),
                    mode: stat.mode,
                    size: stat.size,
                    mtime: stat.mtime
                });
            } catch (err) {
                console.log('[DEBUG-HOST] hostSrcDir exists: false - stat error:', err && err.message);
            }

            try {
                const fstat = await fs.stat(sourceFile);
                console.log('[DEBUG-HOST] expected file exists:', true, 'fileStat:', {
                    size: fstat.size,
                    mtime: fstat.mtime,
                    mode: fstat.mode
                });
            } catch (err) {
                console.log('[DEBUG-HOST] expected file exists: false - stat error:', err && err.message);
            }

            const binds = [`${normalizeWindowsPath(workDir)}:/code/src:ro`];
            const containerWorkingDir = '/home/coderunner/workspace';
            console.log('[DEBUG-HOST] Will use Binds:', binds);
            console.log('[DEBUG-HOST] WorkingDir for container:', containerWorkingDir);

            // Step 3: Prepare Docker configuration
            console.log('\n[Step 3] Preparing Docker configuration...');
            const containerConfig = {
                Image: 'code-executor',
                User: 'coderunner',
                Tty: false,
                WorkingDir: '/home/coderunner/workspace',
                Entrypoint: ['/bin/sh'],
                Cmd: [
                    '-c',
                    `set -e
cp /code/src/code.cpp /home/coderunner/workspace/code.cpp
g++ -Wall -o /home/coderunner/workspace/program /home/coderunner/workspace/code.cpp 2>&1
if [ $? -ne 0 ]; then
    echo "ERROR: Compilation failed" >&2
    exit 1
fi
cd /home/coderunner/workspace
./program`
                ],
                HostConfig: {
                    Memory: this.config.MAX_MEMORY_USAGE,
                    MemorySwap: this.config.MAX_MEMORY_USAGE,
                    NanoCPUs: 2 * 1000000000,
                    SecurityOpt: ['no-new-privileges'],
                    CapDrop: 'ALL',
                    ReadonlyRootfs: false,
                    PidsLimit: 50
                }
            };

            const normalizedWorkDir = normalizeWindowsPath(workDir);
            console.log('Creating container with config:', {
                ...containerConfig,
                HostConfig: {
                    ...containerConfig.HostConfig,
                    Binds: [`${normalizedWorkDir}:/code/src:ro`]
                }
            });

            let container;
            try {
                container = await this.docker.createContainer({
                    ...containerConfig,
                    HostConfig: {
                        ...containerConfig.HostConfig,
                        Binds: [`${normalizedWorkDir}:/code/src:ro`]
                    }
                });
            } catch (bindError) {
                console.log('Bind mount failed, falling back to putArchive');
                // Create container without bind
                container = await this.docker.createContainer({
                    ...containerConfig,
                    HostConfig: {
                        ...containerConfig.HostConfig
                    }
                });

                // Upload source via putArchive
                const pack = createSourceTar(code);
                await container.putArchive(pack, {
                    path: '/code/src'
                });
            }
            
            console.log('Container created successfully');
            
            // Set up output handling first
            console.log('Setting up container output streams...');
            const stream = await container.attach({
                stream: true,
                stdout: true,
                stderr: true,
                follow: true
            });

            let output = '';
            stream.on('data', (chunk) => {
                // Docker multiplexes streams, first byte indicates if it's stdout (1) or stderr (2)
                const actualData = chunk.slice(8); // Skip header
                output += actualData.toString('utf8');
            });

            console.log('Starting container...');
            await container.start();
            console.log('Container started, waiting for completion...');
            
            // Wait for container to finish
            const result = await container.wait();
            console.log('Container execution completed with status:', result);

            // Give a moment for output buffer to flush
            await new Promise(resolve => setTimeout(resolve, 100));

            // Process the output
            const processedOutput = output
                .split('\n')
                .filter(line => line.trim())
                .join('\n');

            return {
                exitCode: result.StatusCode,
                output: processedOutput,
                error: result.StatusCode !== 0 ? `Execution failed with code ${result.StatusCode}` : null
            };

        } catch (error) {
            throw new Error(`Execution failed: ${error.message}`);
        } finally {
            await fs.rm(workDir, { recursive: true, force: true }).catch(console.error);
        }
    },

    async ensureImage() {
        try {
            console.log('Checking for Docker image "code-executor"...');
            await this.docker.getImage('code-executor').inspect();
            console.log('Docker image found successfully');
        } catch (error) {
            console.error('Docker image error:', error.message);
            throw new Error('Docker image "code-executor" not found. Please build it first.');
        }
    }
});
