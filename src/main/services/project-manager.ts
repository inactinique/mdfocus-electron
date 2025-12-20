// @ts-nocheck
import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { configManager } from './config-manager.js';

interface Project {
  id?: string;
  name: string;
  type?: string;
  path: string;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt?: string;
  content?: string;
  bibliography?: string;
  chapters?: Chapter[];
}

interface Chapter {
  id: string;
  title: string;
  order: number;
  filePath: string;
}

export class ProjectManager {
  async createProject(data: { name: string; type?: string; path: string; content?: string }) {
    const projectType = data.type || 'article';

    // For notes type, use the path directly (existing folder)
    // For other types, create a subfolder with the project name
    const projectPath = projectType === 'notes' ? data.path : path.join(data.path, data.name);

    // Create folder only for non-notes projects
    if (projectType !== 'notes' && !existsSync(projectPath)) {
      await mkdir(projectPath, { recursive: true });
    }

    const project: Project = {
      id: crypto.randomUUID(),
      name: data.name,
      type: projectType,
      path: projectPath,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastOpenedAt: new Date().toISOString(),
      content: data.content || '',
    };

    // For notes type, don't create project.json, just remember the folder
    if (projectType === 'notes') {
      // Just add to recent projects (folder path)
      configManager.addRecentProject(projectPath);
      console.log('✅ Notes folder opened:', projectPath);
      return { success: true, path: projectPath, project };
    }

    // For other project types, create project.json
    const projectFile = path.join(projectPath, 'project.json');
    await writeFile(projectFile, JSON.stringify(project, null, 2));

    // Create markdown file
    const mdFile = path.join(projectPath, 'document.md');
    await writeFile(mdFile, data.content || '# ' + data.name);

    // Add to recent projects
    configManager.addRecentProject(projectFile);

    console.log('✅ Project created:', projectPath);
    return { success: true, path: projectFile, project };
  }

  async loadProject(projectPath: string) {
    try {
      // Check if it's a notes folder (directory without project.json)
      const { stat } = await import('fs/promises');
      const stats = await stat(projectPath);

      if (stats.isDirectory()) {
        // It's a notes folder
        const folderName = path.basename(projectPath);
        const project: Project = {
          id: crypto.randomUUID(),
          name: folderName,
          type: 'notes',
          path: projectPath,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastOpenedAt: new Date().toISOString(),
        };

        configManager.addRecentProject(projectPath);
        console.log('✅ Notes folder loaded:', projectPath);
        return { success: true, project };
      }

      // It's a project.json file
      const content = await readFile(projectPath, 'utf-8');
      const project: Project = JSON.parse(content);

      // Update lastOpenedAt
      project.lastOpenedAt = new Date().toISOString();

      // Load markdown content
      const mdFile = path.join(path.dirname(projectPath), 'document.md');
      if (existsSync(mdFile)) {
        project.content = await readFile(mdFile, 'utf-8');
      }

      // Save update
      await writeFile(projectPath, JSON.stringify(project, null, 2));

      configManager.addRecentProject(projectPath);
      console.log('✅ Project loaded:', projectPath);

      return { success: true, project };
    } catch (error) {
      console.error('❌ Failed to load project:', error);
      return { success: false, error: error.message };
    }
  }

  async saveProject(data: { path: string; content: string; bibliography?: string }) {
    try {
      // Charger le projet existant
      const projectContent = await readFile(data.path, 'utf-8');
      const project: Project = JSON.parse(projectContent);

      // Mettre à jour
      project.updatedAt = new Date().toISOString();
      if (data.bibliography !== undefined) {
        project.bibliography = data.bibliography;
      }

      // Sauvegarder le projet
      await writeFile(data.path, JSON.stringify(project, null, 2));

      // Sauvegarder le markdown
      const mdFile = path.join(path.dirname(data.path), 'document.md');
      await writeFile(mdFile, data.content);

      console.log('✅ Project saved:', data.path);
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to save project:', error);
      return { success: false, error: error.message };
    }
  }

  async getChapters(projectId: string) {
    try {
      // Pour l'instant, retourner un chapitre par défaut basé sur document.md
      // Dans une version future, on pourra gérer plusieurs chapitres
      const chapters: Chapter[] = [
        {
          id: 'main',
          title: 'Document principal',
          order: 0,
          filePath: 'document.md',
        },
      ];

      return { success: true, chapters };
    } catch (error) {
      console.error('❌ Failed to get chapters:', error);
      return { success: false, chapters: [], error: error.message };
    }
  }
}

export const projectManager = new ProjectManager();
