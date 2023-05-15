import kotlin.math.*

fun main() {
    print("Inserisci una funzione (utilizza 'x' come variabile): ")
    val input = readLine() ?: return
    plotFunction(input)
}

fun plotFunction(function: String) {
    val range = -10.0..10.0
    val step = 0.1

    for (x in range step step) {
        val y = evaluateFunction(function, x)
        val height = (y / 2).toInt()
        val line = " ".repeat(50 + height) + "*"
        println(line)
    }
}

fun evaluateFunction(function: String, x: Double): Double {
    val expression = function.replace("x", "($x)")
    return try {
        ScriptEngineManager().getEngineByName("js").eval(expression) as Double
    } catch (e: Exception) {
        Double.NaN
    }
}