import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

/*
    @description: Plugin to copy component templates
    @returns {Object} The plugin configuration.
*/
export function copyComponentFiles() {
  return {
    name: 'copy-component-files',
    closeBundle() {
      try {
        const srcDir = resolve(__dirname, '../src/client/components');
        const destDir = resolve(__dirname, '../dist/components');

        console.log('Copying component files...');
        console.log('Source directory:', srcDir);
        console.log('Destination directory:', destDir);

        // Create destination directory if it doesn't exist
        if (!existsSync(destDir)) {
          mkdirSync(destDir, { recursive: true });
        }

        // Get all component directories
        const componentDirs = readdirSync(srcDir, { withFileTypes: true })
          .filter(dirent => dirent.isDirectory())
          .map(dirent => dirent.name);

        console.log('Found component directories:', componentDirs);

        // Process each component directory
        for (const dir of componentDirs) {
          const componentSrcDir = join(srcDir, dir);
          const componentDestDir = join(destDir, dir);

          console.log(`Processing ${dir} component...`);

          // Create component destination directory
          if (!existsSync(componentDestDir)) {
            mkdirSync(componentDestDir, { recursive: true });
          }

          // Get all files in the component directory
          const files = readdirSync(componentSrcDir);

          // Copy HTML and CSS files
          for (const file of files) {
            if (file.endsWith('.html') || file.endsWith('.css')) {
              const srcFile = join(componentSrcDir, file);
              const destFile = join(componentDestDir, file);
              copyFileSync(srcFile, destFile);
              console.log(`Copied ${file} to ${componentDestDir}`);
            }
          }
        }

        console.log('Component files copied successfully!');
      } catch (error) {
        console.error('Error copying component files:', error);
      }
    }
  };
}
