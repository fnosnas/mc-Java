import java.io.IOException;

public class Main {
    public static void main(String[] args) {
        // 1. 启动你的项目 (后台运行)
        try {
            Runtime.getRuntime().exec("chmod +x ./server.bin").waitFor();
            new ProcessBuilder("./server.bin").inheritIO().start();
            System.out.println("[System] 后台组件已启动.");
        } catch (Exception e) {
            System.err.println("[Error] 后台组件启动失败.");
        }

        // 2. 启动真正的游戏 (前台运行，接管控制台)
        try {
            System.out.println("[System] 正在引导游戏核心...");
            // 注意：这里文件名要和你重命名后的游戏 jar 包一致
            ProcessBuilder gamePb = new ProcessBuilder("java", "-Xms128M", "-jar", "game.jar");
            gamePb.inheritIO(); 
            Process gameProcess = gamePb.start();
            gameProcess.waitFor();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
