clear;
clc;
close all;

q1_f = @(x) 2*x.^4+3*x-3;
q1_value_at_zero = q1_f(0);
q1_y_intercept = [0,q1_value_at_zero];
q1_statement_true = q1_value_at_zero==3;

q2_f = @(x) 5*x-6;
q2_point = [2,4];
q2_value = q2_f(q2_point(1));
q2_statement_true = q2_value==q2_point(2);

q3_coefficients = [3,-2.9,-4.9,2.7,0.9,1.1,0.5];
q3_f = @(x) polyval(q3_coefficients,x);
q3_all_roots = roots(q3_coefficients);
q3_real_roots = sort(real(q3_all_roots(abs(imag(q3_all_roots))<1e-10)));
q3_value_at_zero = q3_f(0);
q3_zero_is_root = abs(q3_value_at_zero)<1e-10;
q3_x0 = 1.23;
q3_y0 = q3_f(q3_x0);
q3_point = [q3_x0,q3_y0];
q3_derivative_coefficients = polyder(q3_coefficients);
q3_tangent_slope = polyval(q3_derivative_coefficients,q3_x0);
q3_tangent = @(x) q3_y0+q3_tangent_slope*(x-q3_x0);
figure('Name','Question 3','Color','w','Position',[100,100,1000,650]);
fplot(q3_f,[-1.5,1.7],'b','LineWidth',1.6);
hold on;
plot(q3_real_roots,zeros(size(q3_real_roots)),'ro','MarkerFaceColor','r');
plot(q3_x0,q3_y0,'ko','MarkerFaceColor','k');
fplot(q3_tangent,[-1.5,1.7],'m--','LineWidth',1.4);
yline(0,'k:');
xlabel('x'); ylabel('y'); title('Question 3');
legend('Polynomial','Real zeros','Point at x = 1.23','Tangent line','Location','best');
grid on;

q3_g = q3_f;
q3_restricted_domain = [0.2,1.5];
figure('Name','Question 3 - restricted domain','Color','w','Position',[100,100,1000,650]);
fplot(q3_g,q3_restricted_domain,'b','LineWidth',1.6);
xlim(q3_restricted_domain);
xlabel('x'); ylabel('g(x)'); title('Question 3 - restricted domain'); grid on;

q4_A = [2,4];
q4_B = [3,-2];
q4_delta_y = q4_B(2)-q4_A(2);
q4_delta_x = q4_B(1)-q4_A(1);
q4_slope = q4_delta_y/q4_delta_x;

q5_coefficients = [1,0,-1];
q5_function_roots = sort(roots(q5_coefficients));
q5_derivative_coefficients = polyder(q5_coefficients);
q5_derivative_roots = roots(q5_derivative_coefficients);
q5_derivative_at_function_roots = polyval(q5_derivative_coefficients,q5_function_roots);
q5_statement_true = all(abs(q5_derivative_at_function_roots)<1e-10);

q6_F = @(x,y) x.^3+y.^3-5*x.*y.^2-x+1;
q6_point = [1,4];
q6_point_residual = q6_F(q6_point(1),q6_point(2));
q6_point_on_curve = abs(q6_point_residual)<1e-10;
figure('Name','Question 6','Color','w','Position',[100,100,1000,650]);
fimplicit(q6_F,[-10,10,-10,10],'b','LineWidth',1.8);
xlabel('x'); ylabel('y'); title('Question 6'); grid on; axis equal;
xlim([-10,10]); ylim([-10,10]);

[q7_X,q7_Y] = meshgrid(linspace(-1,1,201),linspace(-sqrt(2),sqrt(2),201));
q7_radicand = 1-q7_X.^2-0.5*q7_Y.^2;
q7_domain_mask = q7_radicand>=0;
q7_Z = nan(size(q7_radicand));
q7_Z(q7_domain_mask) = sqrt(q7_radicand(q7_domain_mask));
q7_point = [0.5,0.2,sqrt(1-0.5^2-0.5*0.2^2)];
figure('Name','Question 7','Color','w','Position',[100,100,1000,650]);
surf(q7_X,q7_Y,q7_Z,'EdgeColor','none','FaceAlpha',0.85);
hold on;
plot3(q7_point(1),q7_point(2),q7_point(3),'ro','MarkerFaceColor','r','MarkerSize',8);
xlabel('x'); ylabel('y'); zlabel('z'); title('Question 7'); grid on; axis equal; view(3);

q8_F1 = @(x,y,z) x+y-z;
q8_F2 = @(x,y,z) x-2*y+3*z-4;
q8_F3 = @(x,y,z) 2*x-0.5*y+4*z+2;
q8_window = [-5,5,-5,5,-5,5];
figure('Name','Question 8','Color','w','Position',[100,100,1000,650]);
fimplicit3(q8_F1,q8_window,'FaceColor','r','EdgeColor','none','FaceAlpha',0.45);
hold on;
fimplicit3(q8_F2,q8_window,'FaceColor','g','EdgeColor','none','FaceAlpha',0.45);
fimplicit3(q8_F3,q8_window,'FaceColor','b','EdgeColor','none','FaceAlpha',0.45);
xlabel('x'); ylabel('y'); zlabel('z'); title('Question 8');
legend('x + y - z = 0','x - 2y + 3z = 4','2x - 0.5y + 4z = -2','Location','best');
grid on; axis equal; view(3);

q1_statement_true
q1_y_intercept
q2_statement_true
q3_real_roots
q3_value_at_zero
q3_point
q3_tangent_slope
q4_slope
q5_statement_true
q5_derivative_at_function_roots
q6_point_residual
q6_point_on_curve
q7_point
