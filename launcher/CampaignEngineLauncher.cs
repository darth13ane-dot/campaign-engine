using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

namespace CampaignEngineLauncher
{
    internal static class Program
    {
        [STAThread]
        private static int Main()
        {
            string indexPath = FindIndexHtml();
            if (String.IsNullOrEmpty(indexPath))
            {
                MessageBox.Show(
                    "Campaign Engine could not find index.html. Keep this executable in the Campaign Engine folder, or use the packaged portable folder.",
                    "Campaign Engine",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
                return 1;
            }

            string url = new Uri(indexPath).AbsoluteUri;

            try
            {
                string appBrowser = FindAppBrowser();
                if (!String.IsNullOrEmpty(appBrowser))
                {
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = appBrowser,
                        Arguments = "--app=\"" + url + "\"",
                        UseShellExecute = false
                    });
                }
                else
                {
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = url,
                        UseShellExecute = true
                    });
                }
                return 0;
            }
            catch (Exception error)
            {
                MessageBox.Show(
                    "Campaign Engine could not be opened: " + error.Message,
                    "Campaign Engine",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
                return 1;
            }
        }

        private static string FindIndexHtml()
        {
            string exeDir = AppDomain.CurrentDomain.BaseDirectory;
            string[] candidates = new string[]
            {
                Path.Combine(exeDir, "index.html"),
                Path.Combine(exeDir, "app", "index.html"),
                SafeFullPath(Path.Combine(exeDir, "..", "index.html")),
                @"C:\Users\darth\OneDrive\Documents\Campaign Engine\index.html"
            };

            foreach (string candidate in candidates)
            {
                if (!String.IsNullOrEmpty(candidate) && File.Exists(candidate)) return candidate;
            }

            return "";
        }

        private static string FindAppBrowser()
        {
            string programFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
            string programFilesX86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
            string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);

            string[] candidates = new string[]
            {
                Path.Combine(programFiles, "Microsoft", "Edge", "Application", "msedge.exe"),
                Path.Combine(programFilesX86, "Microsoft", "Edge", "Application", "msedge.exe"),
                Path.Combine(localAppData, "Microsoft", "Edge", "Application", "msedge.exe"),
                Path.Combine(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
                Path.Combine(programFilesX86, "Google", "Chrome", "Application", "chrome.exe"),
                Path.Combine(localAppData, "Google", "Chrome", "Application", "chrome.exe")
            };

            foreach (string candidate in candidates)
            {
                if (File.Exists(candidate)) return candidate;
            }

            return "";
        }

        private static string SafeFullPath(string path)
        {
            try
            {
                return Path.GetFullPath(path);
            }
            catch
            {
                return "";
            }
        }
    }
}
