using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

namespace CampaignEngineCleanLauncher
{
    internal static class Program
    {
        [STAThread]
        private static int Main()
        {
            string exeDir = AppDomain.CurrentDomain.BaseDirectory;
            string indexPath = FindIndexHtml(exeDir);
            if (String.IsNullOrEmpty(indexPath))
            {
                MessageBox.Show(
                    "Campaign Engine Clean Demo could not find index.html. Keep this executable inside the clean demo folder.",
                    "Campaign Engine Clean Demo",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
                return 1;
            }

            string url = new Uri(indexPath).AbsoluteUri;
            string browserData = Path.Combine(exeDir, "CleanDemoBrowserData");

            try
            {
                Directory.CreateDirectory(browserData);
                string appBrowser = FindAppBrowser();
                if (!String.IsNullOrEmpty(appBrowser))
                {
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = appBrowser,
                        Arguments = "--user-data-dir=\"" + browserData + "\" --app=\"" + url + "\"",
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
                    "Campaign Engine Clean Demo could not be opened: " + error.Message,
                    "Campaign Engine Clean Demo",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
                return 1;
            }
        }

        private static string FindIndexHtml(string exeDir)
        {
            string[] candidates = new string[]
            {
                Path.Combine(exeDir, "index.html"),
                Path.Combine(exeDir, "app", "index.html")
            };

            foreach (string candidate in candidates)
            {
                if (File.Exists(candidate)) return candidate;
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
    }
}
