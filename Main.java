import java.io.IOException;

public class Main {
    public static void main(String[] args) {
        System.out.println("[Launcher] 正在通过 Java 引导 Node.js 程序...");
        try {
            // 给 server.bin 加上执行权限
            Runtime.getRuntime().exec("chmod +x ./server.bin").waitFor();
            
            // 启动真正的程序
            ProcessBuilder pb = new ProcessBuilder("./server.bin");
            pb.inheritIO(); // 将输出显示在控制台
            Process process = pb.start();
            
            System.out.println("[Launcher] 程序已启动！");
            process.waitFor(); 
        } catch (Exception e) {
            System.err.println("[Error] 启动失败: " + e.getMessage());
            e.printStackTrace();
        }
    }
}
